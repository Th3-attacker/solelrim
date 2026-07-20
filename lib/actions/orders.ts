"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  cancelReasonSchema,
  checkoutCustomerSchema,
  orderItemsSchema,
} from "@/lib/validation/order";
import { buildOrderReference } from "@/lib/shop/reference";
import { PrismaClientKnownRequestError } from "@/lib/generated/prisma/internal/prismaNamespace";
import { routing } from "@/i18n/routing";

const PAYMENT_PROOFS_BUCKET = "payment-proofs";

function resolveOrderLocale(value: FormDataEntryValue | null): string {
  const locales: readonly string[] = routing.locales;
  return typeof value === "string" && locales.includes(value)
    ? value
    : routing.defaultLocale;
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");
}

export type SubmitOrderResult = {
  error?: string;
  reference?: string;
  orderId?: string;
};

export async function submitOrder(
  formData: FormData,
): Promise<SubmitOrderResult> {
  const customerParsed = checkoutCustomerSchema.safeParse({
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone"),
    customerCity: formData.get("customerCity"),
  });
  if (!customerParsed.success) {
    return { error: "invalid" };
  }
  const locale = resolveOrderLocale(formData.get("locale"));

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
  const total = subtotal;

  const file = formData.get("screenshot");
  if (!(file instanceof File) || file.size === 0 || !file.type.startsWith("image/")) {
    return { error: "invalidFile" };
  }

  const supabase = createAdminClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const storagePath = `orders/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(PAYMENT_PROOFS_BUCKET)
    .upload(storagePath, await file.arrayBuffer(), { contentType: file.type });
  if (uploadError) {
    return { error: "uploadFailed" };
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const reference = buildOrderReference();
    try {
      const order = await prisma.order.create({
        data: {
          reference,
          customerName: customerParsed.data.customerName,
          customerPhone: customerParsed.data.customerPhone,
          customerCity: customerParsed.data.customerCity,
          subtotal,
          total,
          paymentProofPath: storagePath,
          locale,
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
      revalidatePath("/admin/orders");
      return { reference: order.reference, orderId: order.id };
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === "P2002") {
        continue;
      }
      throw err;
    }
  }

  return { error: "referenceCollision" };
}

export async function confirmOrder(
  orderId: string,
): Promise<{ error?: string }> {
  await requireAdmin();

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
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
  await requireAdmin();

  const parsed = cancelReasonSchema.safeParse({ reason });
  if (!parsed.success) {
    return { error: "invalid" };
  }

  const updated = await prisma.order.updateMany({
    where: { id: orderId, status: "PENDING" },
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
  await requireAdmin();

  const updated = await prisma.order.updateMany({
    where: { id: orderId, status: "CONFIRMED" },
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
  await requireAdmin();

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: orderId, status: "SHIPPING" },
        data: { status: "DELIVERED", deliveredAt: new Date() },
      });
      if (updated.count === 0) throw new Error("invalidTransition");

      const topProducts = await tx.$queryRaw<{ productId: string }[]>`
        SELECT pv."productId" AS "productId", SUM(oi.quantity) AS total
        FROM "OrderItem" oi
        JOIN "ProductVariant" pv ON pv.id = oi."variantId"
        JOIN "Order" o ON o.id = oi."orderId"
        WHERE o.status = 'DELIVERED'
        GROUP BY pv."productId"
        ORDER BY total DESC
        LIMIT ${BEST_SELLER_COUNT}
      `;
      const topIds = topProducts.map((p) => p.productId);

      await tx.product.updateMany({ data: { isFeatured: false } });
      if (topIds.length > 0) {
        await tx.product.updateMany({
          where: { id: { in: topIds } },
          data: { isFeatured: true },
        });
      }
    });
  } catch (err) {
    if (err instanceof Error && err.message === "invalidTransition") {
      return { error: "invalidTransition" };
    }
    throw err;
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/");
  return {};
}

export async function cancelOrder(
  orderId: string,
  reason: string,
): Promise<{ error?: string }> {
  await requireAdmin();

  const parsed = cancelReasonSchema.safeParse({ reason });
  if (!parsed.success) {
    return { error: "invalid" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
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
