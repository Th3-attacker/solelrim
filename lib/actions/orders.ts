"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStoreTypes } from "@/lib/queries/settings";
import {
  cancelReasonSchema,
  checkoutCustomerSchema,
  orderItemsSchema,
  paymentSenderPhoneSchema,
  trackOrderSchema,
} from "@/lib/validation/order";
import type { OrderStatus } from "@/lib/generated/prisma/enums";
import { buildOrderReference, buildSaleReference } from "@/lib/shop/reference";
import { PrismaClientKnownRequestError } from "@/lib/generated/prisma/internal/prismaNamespace";
import { routing } from "@/i18n/routing";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { validateImageBytes, MAX_IMAGE_BYTES } from "@/lib/shop/image-signature";
import { requireWritableAdminScope } from "@/lib/shop/admin-scope";
import { getEffectiveLicenseState, isLicenseBlocking } from "@/lib/shop/license";
import { findValidPromoCode, computePromoDiscount } from "@/lib/shop/promo-code";
import { logAdminAction } from "@/lib/audit";

const PAYMENT_PROOFS_BUCKET = "payment-proofs";

// Public, unauthenticated action that accepts a file upload — capped per IP
// so it can't be used to spam Storage or flood the admin with fake orders.
const SUBMIT_ORDER_RATE_LIMIT = { windowMs: 15 * 60 * 1000, max: 5 };


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

  const senderPhoneParsed = paymentSenderPhoneSchema.safeParse(
    formData.get("paymentSenderPhone"),
  );
  if (!senderPhoneParsed.success) {
    return { error: "invalid" };
  }

  const locale = resolveOrderLocale(formData.get("locale"));

  // The checkout form sends the boutique it was submitted from (the URL's
  // [storeType] segment) — client-supplied, so it's only trusted once
  // checked against the real registry, same as any other form input.
  const requestedProductType = formData.get("productType");
  const storeTypes = await getStoreTypes();
  const matchedStoreType = storeTypes.find((type) => type.key === requestedProductType);
  if (typeof requestedProductType !== "string" || !matchedStoreType) {
    return { error: "invalid" };
  }
  const productType = requestedProductType;

  // Belt-and-suspenders: the (shop) layout already blocks every page once
  // the license is suspended/expired/cancelled, so this only matters for a
  // tab left open across that moment — same rule, checked again
  // server-side before an order can actually be created.
  if (isLicenseBlocking(getEffectiveLicenseState(matchedStoreType))) {
    return { error: "storefrontExpired" };
  }

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

  // Fast-fail on an obviously stale cart before spending effort on the
  // upload — the atomic decrement inside the transaction below is what
  // actually enforces this against concurrent submissions; this is just a
  // cheap early exit for the common case.
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
  if (!(file instanceof File) || file.size === 0) {
    return { error: "invalidFile" };
  }
  // Checked as its own case (not folded into "invalidFile") so the client
  // can tell the customer exactly what's wrong — checkout-flow.tsx already
  // rejects an oversized pick before it ever uploads, this is the
  // server-side backstop for a request built some other way.
  if (file.size > MAX_IMAGE_BYTES) {
    return { error: "fileTooLarge" };
  }

  // File.type is whatever the browser guessed from the filename — trust the
  // actual bytes instead, so a renamed non-image (or a small-on-disk pixel
  // bomb) can't pass as a "photo".
  const fileBuffer = await file.arrayBuffer();
  const detected = validateImageBytes(new Uint8Array(fileBuffer));
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

  // The proof is uploaded before the transaction (it's part of the order
  // payload), so every path that bails out after this point must delete it
  // or it's an orphaned object in Storage forever. Best-effort — a failed
  // cleanup must never mask the real error being returned.
  const discardProof = async () => {
    try {
      await supabase.storage.from(PAYMENT_PROOFS_BUCKET).remove([storagePath]);
    } catch {
      // swallow — nothing actionable, and the original outcome still stands
    }
  };

  const PROMO_CODE_ERRORS = ["notFound", "expired", "usageLimitReached", "notYours", "alreadyUsed"];

  for (let attempt = 0; attempt < 3; attempt++) {
    const reference = buildOrderReference();
    try {
      const order = await prisma.$transaction(async (tx) => {
        // Reserve stock now, not at admin confirmation — otherwise several
        // orders (the same customer placing more than one, or different
        // customers) can each pass the earlier fast-fail check and all get
        // a "success" screen for stock that only covers one of them, and
        // the conflict only surfaces later when an admin tries to confirm
        // them one by one. The gte guard in the WHERE closes the same
        // read-then-write race the promo-code increment below already
        // guards against: whichever request's update lands first wins.
        for (const item of orderItems) {
          const updated = await tx.productVariant.updateMany({
            where: { id: item.variantId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });
          if (updated.count === 0) {
            throw new Error("insufficientStock");
          }
        }

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
            paymentSenderPhone: senderPhoneParsed.data,
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
        // Two distinct unique constraints can raise P2002 here: the order
        // reference (retry with a fresh one) and, since this Order.create,
        // the promo-phone partial unique index (see migration
        // 20260817090000_promo_phone_unique_index) — a concurrent
        // submission for the same phone + code just won that race.
        const target = Array.isArray(err.meta?.target)
          ? err.meta.target.join(",")
          : String(err.meta?.target ?? "");
        if (target.includes("promoCodeId_customerPhone")) {
          await discardProof();
          return { error: "alreadyUsed" };
        }
        continue;
      }
      if (err instanceof Error && err.message === "insufficientStock") {
        await discardProof();
        return { error: "insufficientStock" };
      }
      if (err instanceof Error && PROMO_CODE_ERRORS.includes(err.message)) {
        await discardProof();
        return { error: err.message };
      }
      await discardProof();
      throw err;
    }
  }

  await discardProof();
  return { error: "referenceCollision" };
}

// Public, unauthenticated lookup — capped per IP against enumeration
// attempts. Requires the exact reference alongside the phone number (not
// just the phone) precisely so knowing/guessing someone's number alone
// isn't enough to see their order history.
const TRACK_ORDER_RATE_LIMIT = { windowMs: 15 * 60 * 1000, max: 10 };

export type TrackOrderResult =
  | { error: string }
  | {
      reference: string;
      status: OrderStatus;
      total: number;
      createdAt: Date;
      // When the current status was reached — createdAt for PENDING,
      // otherwise the matching *At column. Lets the UI say "no movement
      // in N days" instead of just "ordered N days ago", which would
      // misfire on an order that's already progressing normally.
      statusSince: Date;
    };

function getStatusSince(order: {
  status: OrderStatus;
  createdAt: Date;
  confirmedAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  rejectedAt: Date | null;
  cancelledAt: Date | null;
}): Date {
  switch (order.status) {
    case "CONFIRMED":
      return order.confirmedAt ?? order.createdAt;
    case "SHIPPING":
      return order.shippedAt ?? order.createdAt;
    case "DELIVERED":
      return order.deliveredAt ?? order.createdAt;
    case "REJECTED":
      return order.rejectedAt ?? order.createdAt;
    case "CANCELLED":
      return order.cancelledAt ?? order.createdAt;
    default:
      return order.createdAt;
  }
}

export async function trackOrder(input: unknown): Promise<TrackOrderResult> {
  const ip = await getClientIp();
  const allowed = await checkRateLimit(`track-order:${ip}`, TRACK_ORDER_RATE_LIMIT);
  if (!allowed) {
    return { error: "rateLimited" };
  }

  const parsed = trackOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "invalid" };
  }

  const order = await prisma.order.findFirst({
    where: {
      customerPhone: parsed.data.phone,
      reference: parsed.data.reference.toUpperCase(),
      productType: parsed.data.productType,
    },
    select: {
      reference: true,
      status: true,
      total: true,
      createdAt: true,
      confirmedAt: true,
      shippedAt: true,
      deliveredAt: true,
      rejectedAt: true,
      cancelledAt: true,
    },
  });
  if (!order) {
    return { error: "notFound" };
  }

  return {
    reference: order.reference,
    status: order.status,
    total: order.total.toNumber(),
    createdAt: order.createdAt,
    statusSince: getStatusSince(order),
  };
}

export async function confirmOrder(
  orderId: string,
): Promise<{ error?: string }> {
  const { admin, productType } = await requireWritableAdminScope();
  let orderReference = orderId;

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, productType },
      });
      if (!order) throw new Error("notFound");
      if (order.status !== "PENDING") throw new Error("notPending");
      orderReference = order.reference;

      // Stock is reserved at submitOrder time now, not here — confirming
      // just moves the order forward, nothing left to decrement.
      await tx.order.update({
        where: { id: orderId },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
      });
    });
  } catch (err) {
    if (
      err instanceof Error &&
      ["notFound", "notPending"].includes(err.message)
    ) {
      return { error: err.message };
    }
    throw err;
  }

  await logAdminAction({
    adminUserId: admin.id,
    productType,
    action: "order.confirm",
    targetLabel: orderReference,
  });

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/");
  return {};
}

export async function rejectOrder(
  orderId: string,
  reason: string,
): Promise<{ error?: string }> {
  const { admin, productType } = await requireWritableAdminScope();
  let orderReference = orderId;

  const parsed = cancelReasonSchema.safeParse({ reason });
  if (!parsed.success) {
    return { error: "invalid" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Atomically transition PENDING -> REJECTED first — this is the
      // concurrency gate. Two concurrent rejects (a double-click, two
      // admin tabs) can no longer both pass a status check taken before
      // either commits: only the one that actually flips the row here
      // goes on to restitute stock/promo below, so it can never happen
      // twice for the same order.
      const updated = await tx.order.updateMany({
        where: { id: orderId, productType, status: "PENDING" },
        data: {
          status: "REJECTED",
          rejectedAt: new Date(),
          rejectReason: parsed.data.reason,
        },
      });
      if (updated.count === 0) {
        const exists = await tx.order.findFirst({
          where: { id: orderId, productType },
          select: { id: true },
        });
        throw new Error(exists ? "notPending" : "notFound");
      }

      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: true },
      });
      orderReference = order.reference;

      // Give back what submitOrder reserved — these items were never
      // fulfilled, and the customer's promo redemption (if any) shouldn't
      // count against them since findValidPromoCode's one-use-per-phone
      // check excludes rejected orders precisely so they can try again.
      for (const item of order.items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
      }
      if (order.promoCodeId) {
        await tx.promoCode.update({
          where: { id: order.promoCodeId },
          data: { usedCount: { decrement: 1 } },
        });
      }
    });
  } catch (err) {
    if (err instanceof Error && ["notFound", "notPending"].includes(err.message)) {
      return { error: err.message };
    }
    throw err;
  }

  await logAdminAction({
    adminUserId: admin.id,
    productType,
    action: "order.reject",
    targetLabel: orderReference,
  });

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/");
  return {};
}

export async function shipOrder(
  orderId: string,
): Promise<{ error?: string }> {
  const { admin, productType } = await requireWritableAdminScope();

  const updated = await prisma.order.updateMany({
    where: { id: orderId, status: "CONFIRMED", productType },
    data: { status: "SHIPPING", shippedAt: new Date() },
  });
  if (updated.count === 0) {
    return { error: "invalidTransition" };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { reference: true },
  });
  await logAdminAction({
    adminUserId: admin.id,
    productType,
    action: "order.ship",
    targetLabel: order?.reference ?? orderId,
  });

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
  const { admin, productType } = await requireWritableAdminScope();
  let orderReference = orderId;

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: orderId, status: "SHIPPING", productType },
        data: { status: "DELIVERED", deliveredAt: new Date() },
      });
      if (updated.count === 0) throw new Error("invalidTransition");

      // Delivered online orders otherwise never show up as revenue: the
      // dashboard's stats/best-sellers are computed from Sale, not Order.
      // Stock was already decremented at submitOrder, so this only
      // records the sale — it must never touch stock itself.
      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: true },
      });
      orderReference = order.reference;

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

  await logAdminAction({
    adminUserId: admin.id,
    productType,
    action: "order.deliver",
    targetLabel: orderReference,
  });

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
  const { admin, productType } = await requireWritableAdminScope();
  let orderReference = orderId;

  const parsed = cancelReasonSchema.safeParse({ reason });
  if (!parsed.success) {
    return { error: "invalid" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Atomically transition CONFIRMED/SHIPPING -> CANCELLED first — same
      // concurrency gate as rejectOrder, so two concurrent cancels of the
      // same order can't both restitute stock/promo usage.
      const updated = await tx.order.updateMany({
        where: { id: orderId, productType, status: { in: ["CONFIRMED", "SHIPPING"] } },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelReason: parsed.data.reason,
        },
      });
      if (updated.count === 0) {
        const exists = await tx.order.findFirst({
          where: { id: orderId, productType },
          select: { id: true },
        });
        throw new Error(exists ? "invalidTransition" : "notFound");
      }

      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: true },
      });
      orderReference = order.reference;

      // Stock was reserved at submission — give it back since these items
      // are no longer being fulfilled. Same for the promo redemption, if
      // any: it never actually benefited the customer, so it shouldn't
      // block them from using the code again later.
      for (const item of order.items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
      }
      if (order.promoCodeId) {
        await tx.promoCode.update({
          where: { id: order.promoCodeId },
          data: { usedCount: { decrement: 1 } },
        });
      }
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

  await logAdminAction({
    adminUserId: admin.id,
    productType,
    action: "order.cancel",
    targetLabel: orderReference,
  });

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/");
  return {};
}
