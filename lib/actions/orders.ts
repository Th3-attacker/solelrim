"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStoreTypes } from "@/lib/queries/settings";
import {
  cancelReasonSchema,
  checkoutCustomerSchema,
  orderItemsSchema,
} from "@/lib/validation/order";
import { buildOrderReference, buildSaleReference } from "@/lib/shop/reference";
import { PrismaClientKnownRequestError } from "@/lib/generated/prisma/internal/prismaNamespace";
import { routing } from "@/i18n/routing";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { detectImageSignature } from "@/lib/shop/image-signature";
import { requireAdminScope } from "@/lib/shop/admin-scope";
import { findValidPromoCode, computePromoDiscount } from "@/lib/shop/promo-code";

const PAYMENT_PROOFS_BUCKET = "payment-proofs";

// Public, unauthenticated action that accepts a file upload — capped per IP
// so it can't be used to spam Storage or flood the admin with fake orders.
const SUBMIT_ORDER_RATE_LIMIT = { windowMs: 15 * 60 * 1000, max: 5 };

// Payment screenshots are small phone captures in practice; well under the
// Server Action's global 2mb body limit (next.config.ts), which covers the
// whole multipart request, not just this field.
const MAX_SCREENSHOT_BYTES = 1.5 * 1024 * 1024;

function resolveOrderLocale(value: FormDataEntryValue | null): string {
  const locales: readonly string[] = routing.locales;
  return typeof value === "string" && locales.includes(value)
    ? value
    : routing.defaultLocale;
}

export type SubmitOrderResult = {
  error?: string;
  reference?: string;
  orderId?: string;
};

export async function submitOrder(
  formData: FormData,
): Promise<SubmitOrderResult> {
  const ip = await getClientIp();
  const allowed = await checkRateLimit(`order:${ip}`, SUBMIT_ORDER_RATE_LIMIT);
  if (!allowed) {
    return { error: "rateLimited" };
  }

  const customerParsed = checkoutCustomerSchema.safeParse({
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone"),
    customerCity: formData.get("customerCity"),
  });
  if (!customerParsed.success) {
    return { error: "invalid" };
  }
  const locale = resolveOrderLocale(formData.get("locale"));

  // The checkout form sends the boutique it was submitted from (the URL's
  // [storeType] segment) — client-supplied, so it's only trusted once
  // checked against the real registry, same as any other form input.
  const requestedProductType = formData.get("productType");
  const storeTypes = await getStoreTypes();
  if (
    typeof requestedProductType !== "string" ||
    !storeTypes.some((type) => type.key === requestedProductType)
  ) {
    return { error: "invalid" };
  }
  const productType = requestedProductType;

  let rawItems: unknown;
  try {
    rawItems = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { error: "invalid" };
  }
  const itemsParsed = orderItemsSchema.safeParse(rawItems);
  if (!itemsParsed.success) {
    return { error: "invalid" };
  }

  const variantIds = itemsParsed.data.map((i) => i.variantId);
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    include: { product: true },
  });
  const variantById = new Map(variants.map((v) => [v.id, v]));

  if (variantById.size !== new Set(variantIds).size) {
    return { error: "invalid" };
  }

  // The cart is scoped to one boutique client-side (per-boutique localStorage
  // key), but nothing stops a crafted request from mixing variant ids across
  // boutiques — reject rather than create an order that misattributes one.
  if (variants.some((v) => v.product.productType !== productType)) {
    return { error: "invalid" };
  }

  const orderItems = itemsParsed.data.map((item) => {
    const variant = variantById.get(item.variantId)!;
    const unitPrice = (variant.price ?? variant.product.basePrice).toNumber();
    return {
      variantId: item.variantId,
      quantity: item.quantity,
      unitPrice,
      lineTotal: unitPrice * item.quantity,
      variantStock: variant.stock,
    };
  });

  const insufficient = orderItems.find(
    (item) => item.variantStock < item.quantity,
  );
  if (insufficient) {
    return { error: "insufficientStock" };
  }

  const subtotal = orderItems.reduce((sum, i) => sum + i.lineTotal, 0);

  // Optional — a blank/missing code just means no discount, not an error.
  const rawPromoCode = formData.get("promoCode");
  const promoCodeInput =
    typeof rawPromoCode === "string" && rawPromoCode.trim() ? rawPromoCode.trim() : null;

  const file = formData.get("screenshot");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_SCREENSHOT_BYTES) {
    return { error: "invalidFile" };
  }

  // File.type is whatever the browser guessed from the filename — trust the
  // actual bytes instead, so a renamed non-image can't pass as a "photo".
  const fileBuffer = await file.arrayBuffer();
  const detected = detectImageSignature(new Uint8Array(fileBuffer));
  if (!detected) {
    return { error: "invalidFile" };
  }

  const supabase = createAdminClient();
  const storagePath = `orders/${crypto.randomUUID()}.${detected.extension}`;
  const { error: uploadError } = await supabase.storage
    .from(PAYMENT_PROOFS_BUCKET)
    .upload(storagePath, fileBuffer, { contentType: detected.contentType });
  if (uploadError) {
    return { error: "uploadFailed" };
  }

  const PROMO_CODE_ERRORS = ["notFound", "expired", "usageLimitReached", "notYours"];

  for (let attempt = 0; attempt < 3; attempt++) {
    const reference = buildOrderReference();
    try {
      const order = await prisma.$transaction(async (tx) => {
        // Re-validated from scratch here, inside the same transaction that
        // increments usedCount — never trusts whatever the checkout preview
        // (previewPromoCode) showed the customer, which could be stale by
        // the time this submits (code deactivated, limit hit by someone
        // else, etc).
        let discount = 0;
        let promoCodeId: string | null = null;
        if (promoCodeInput) {
          const result = await findValidPromoCode(tx, {
            code: promoCodeInput,
            productType,
            customerPhone: customerParsed.data.customerPhone,
          });
          if ("error" in result) {
            throw new Error(result.error);
          }
          discount = computePromoDiscount(result.promoCode, subtotal);
          promoCodeId = result.promoCode.id;
          const { maxUses } = result.promoCode;
          // The read above and this increment aren't atomic on their own —
          // under READ COMMITTED, two concurrent submits for the same
          // maxUses-limited code could both pass the check before either
          // commits. Re-asserting usedCount < maxUses in the UPDATE's WHERE
          // closes that gap: if someone else's increment lands first,
          // updated.count is 0 here and this one loses the race instead of
          // silently overselling the code.
          const updated = await tx.promoCode.updateMany({
            where: {
              id: promoCodeId,
              ...(maxUses !== null ? { usedCount: { lt: maxUses } } : {}),
            },
            data: { usedCount: { increment: 1 } },
          });
          if (updated.count === 0) {
            throw new Error("usageLimitReached");
          }
        }

        return tx.order.create({
          data: {
            reference,
            customerName: customerParsed.data.customerName,
            customerPhone: customerParsed.data.customerPhone,
            customerCity: customerParsed.data.customerCity,
            subtotal,
            discount,
            total: Math.max(subtotal - discount, 0),
            promoCodeId,
            paymentProofPath: storagePath,
            locale,
            productType,
            items: {
              create: orderItems.map((i) => ({
                variantId: i.variantId,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                lineTotal: i.lineTotal,
              })),
            },
          },
        });
      });
      revalidatePath("/admin/orders");
      return { reference: order.reference, orderId: order.id };
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === "P2002") {
        continue;
      }
      if (err instanceof Error && PROMO_CODE_ERRORS.includes(err.message)) {
        return { error: err.message };
      }
      throw err;
    }
  }

  return { error: "referenceCollision" };
}

export async function confirmOrder(
  orderId: string,
): Promise<{ error?: string }> {
  const { productType } = await requireAdminScope();

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, productType },
        include: { items: true },
      });
      if (!order) throw new Error("notFound");
      if (order.status !== "PENDING") throw new Error("notPending");

      for (const item of order.items) {
        const variant = await tx.productVariant.findUnique({
          where: { id: item.variantId },
        });
        if (!variant || variant.stock < item.quantity) {
          throw new Error("insufficientStock");
        }
      }

      for (const item of order.items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      await tx.order.update({
        where: { id: orderId },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
      });
    });
  } catch (err) {
    if (
      err instanceof Error &&
      ["notFound", "notPending", "insufficientStock"].includes(err.message)
    ) {
      return { error: err.message };
    }
    throw err;
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/");
  return {};
}

export async function rejectOrder(
  orderId: string,
  reason: string,
): Promise<{ error?: string }> {
  const { productType } = await requireAdminScope();

  const parsed = cancelReasonSchema.safeParse({ reason });
  if (!parsed.success) {
    return { error: "invalid" };
  }

  const updated = await prisma.order.updateMany({
    where: { id: orderId, status: "PENDING", productType },
    data: {
      status: "REJECTED",
      rejectedAt: new Date(),
      rejectReason: parsed.data.reason,
    },
  });
  if (updated.count === 0) {
    return { error: "notPending" };
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  return {};
}

export async function shipOrder(
  orderId: string,
): Promise<{ error?: string }> {
  const { productType } = await requireAdminScope();

  const updated = await prisma.order.updateMany({
    where: { id: orderId, status: "CONFIRMED", productType },
    data: { status: "SHIPPING", shippedAt: new Date() },
  });
  if (updated.count === 0) {
    return { error: "invalidTransition" };
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  return {};
}

// Best-sellers on the storefront (Product.isFeatured) are recalculated from
// scratch every time an order is delivered, rather than left as a manual
// admin checkbox — the top N products by total delivered quantity become
// the featured set, everyone else loses the badge.
const BEST_SELLER_COUNT = 5;

export async function deliverOrder(
  orderId: string,
): Promise<{ error?: string }> {
  const { productType } = await requireAdminScope();

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: orderId, status: "SHIPPING", productType },
        data: { status: "DELIVERED", deliveredAt: new Date() },
      });
      if (updated.count === 0) throw new Error("invalidTransition");

      // Delivered online orders otherwise never show up as revenue: the
      // dashboard's stats/best-sellers are computed from Sale, not Order.
      // Stock was already decremented at confirmOrder, so this only
      // records the sale — it must never touch stock itself.
      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: true },
      });

      // Best-sellers are scoped to the delivered order's own boutique —
      // otherwise a delivery in one boutique would reset/override the
      // "best-seller" badge for the other boutique's products too.
      const topProducts = await tx.$queryRaw<{ productId: string }[]>`
        SELECT pv."productId" AS "productId", SUM(oi.quantity) AS total
        FROM "OrderItem" oi
        JOIN "ProductVariant" pv ON pv.id = oi."variantId"
        JOIN "Product" p ON p.id = pv."productId"
        JOIN "Order" o ON o.id = oi."orderId"
        WHERE o.status = 'DELIVERED' AND p."productType" = ${order.productType}
        GROUP BY pv."productId"
        ORDER BY total DESC
        LIMIT ${BEST_SELLER_COUNT}
      `;
      const topIds = topProducts.map((p) => p.productId);

      await tx.product.updateMany({
        where: { productType: order.productType },
        data: { isFeatured: false },
      });
      if (topIds.length > 0) {
        await tx.product.updateMany({
          where: { id: { in: topIds } },
          data: { isFeatured: true },
        });
      }

      let attempt = 0;
      while (attempt < 3) {
        const reference = buildSaleReference();
        try {
          await tx.sale.create({
            data: {
              reference,
              subtotal: order.subtotal,
              discount: order.discount,
              total: order.total,
              notes: `Commande en ligne ${order.reference}`,
              productType: order.productType,
              items: {
                create: order.items.map((item) => ({
                  variantId: item.variantId,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  lineTotal: item.lineTotal,
                })),
              },
            },
          });
          break;
        } catch (err) {
          if (err instanceof PrismaClientKnownRequestError && err.code === "P2002") {
            attempt++;
            continue;
          }
          throw err;
        }
      }
      if (attempt >= 3) throw new Error("referenceCollision");
    });
  } catch (err) {
    if (
      err instanceof Error &&
      ["invalidTransition", "referenceCollision"].includes(err.message)
    ) {
      return { error: err.message };
    }
    throw err;
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/sales");
  revalidatePath("/");
  return {};
}

export async function cancelOrder(
  orderId: string,
  reason: string,
): Promise<{ error?: string }> {
  const { productType } = await requireAdminScope();

  const parsed = cancelReasonSchema.safeParse({ reason });
  if (!parsed.success) {
    return { error: "invalid" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, productType },
        include: { items: true },
      });
      if (!order) throw new Error("notFound");
      if (order.status !== "CONFIRMED" && order.status !== "SHIPPING") {
        throw new Error("invalidTransition");
      }

      // Stock was decremented at confirmation time — give it back since
      // these items are no longer being fulfilled.
      for (const item of order.items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelReason: parsed.data.reason,
        },
      });
    });
  } catch (err) {
    if (
      err instanceof Error &&
      ["notFound", "invalidTransition"].includes(err.message)
    ) {
      return { error: err.message };
    }
    throw err;
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/");
  return {};
}
