"use server";

import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { cancelReasonSchema } from "@/lib/validation/order";
import { buildSaleReference } from "@/lib/shop/reference";
import { PrismaClientKnownRequestError } from "@/lib/generated/prisma/internal/prismaNamespace";
import { requireWritableAdminScope } from "@/lib/auth/scope";
import { logAdminAction } from "@/lib/audit";
import { sendOrderPush } from "@/lib/push/order-push";
import { notifyOrdersChanged } from "@/lib/realtime";
import { revalidateSite, revalidateAdmin } from "@/lib/revalidate";
import {
  orderInputFrom,
  placeOrder,
  trackOrder as lookUpOrder,
  type PlaceOrderResult,
  type TrackOrderResult,
} from "@/lib/services/orders";

// The customer side (placing and tracking an order) lives in
// lib/services/orders.ts, shared with the app's API routes; these are the
// website's entry points to it.

export type {
  PlaceOrderResult as SubmitOrderResult,
  TrackOrderResult,
  TrackedOrderItem,
} from "@/lib/services/orders";

export async function submitOrder(
  formData: FormData,
  options?: { idempotencyKey?: string },
): Promise<PlaceOrderResult> {
  return placeOrder(orderInputFrom(formData), options);
}

export async function trackOrder(input: unknown): Promise<TrackOrderResult> {
  return lookUpOrder(input);
}

export async function confirmOrder(orderId: string): Promise<{ error?: string }> {
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
    if (err instanceof Error && ["notFound", "notPending"].includes(err.message)) {
      return { error: err.message };
    }
    throw err;
  }

  await logAdminAction({
    admin,
    productType,
    action: "order.confirm",
    targetLabel: orderReference,
    targetId: orderId,
  });

  // After the response: the admin doesn't wait on Expo (up to 4 s), and a
  // push that fails never touches the action (sendOrderPush never throws).
  after(() => sendOrderPush(orderId, "confirmed"));
  after(() => notifyOrdersChanged(productType));
  revalidateSite();
  return {};
}

export async function rejectOrder(orderId: string, reason: string): Promise<{ error?: string }> {
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
    admin,
    productType,
    action: "order.reject",
    targetLabel: orderReference,
    targetId: orderId,
    reason,
  });

  after(() => sendOrderPush(orderId, "rejected"));
  after(() => notifyOrdersChanged(productType));
  revalidateSite();
  return {};
}

export async function shipOrder(orderId: string): Promise<{ error?: string }> {
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
    admin,
    productType,
    action: "order.ship",
    targetLabel: order?.reference ?? orderId,
    targetId: orderId,
  });

  after(() => sendOrderPush(orderId, "shipped"));
  after(() => notifyOrdersChanged(productType));
  revalidateAdmin();
  return {};
}

// Best-sellers on the storefront (Product.isFeatured) are recalculated from
// scratch every time an order is delivered, rather than left as a manual
// admin checkbox — the top N products by total delivered quantity become
// the featured set, everyone else loses the badge.
const BEST_SELLER_COUNT = 5;

export async function deliverOrder(orderId: string): Promise<{ error?: string }> {
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

      // Online orders are always paid by mobile money, so the sale says so —
      // a later refund then knows how the money goes back (the order doesn't
      // record which wallet, only the sender's number). The customer is
      // linked only when their phone matches exactly one client of the
      // boutique; a doubtful match is left unlinked rather than guessed.
      const matchingClients = await tx.client.findMany({
        where: { productType: order.productType, phone: order.customerPhone },
        select: { id: true },
        take: 2,
      });
      const clientId = matchingClients.length === 1 ? matchingClients[0].id : null;

      let attempt = 0;
      while (attempt < 3) {
        const reference = buildSaleReference();
        try {
          await tx.sale.create({
            data: {
              reference,
              clientId,
              paymentMethod: "wallet",
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
    if (err instanceof Error && ["invalidTransition", "referenceCollision"].includes(err.message)) {
      return { error: err.message };
    }
    throw err;
  }

  await logAdminAction({
    admin,
    productType,
    action: "order.deliver",
    targetLabel: orderReference,
    targetId: orderId,
  });

  after(() => sendOrderPush(orderId, "delivered"));
  after(() => notifyOrdersChanged(productType));
  revalidateSite();
  return {};
}

export async function cancelOrder(orderId: string, reason: string): Promise<{ error?: string }> {
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
    if (err instanceof Error && ["notFound", "invalidTransition"].includes(err.message)) {
      return { error: err.message };
    }
    throw err;
  }

  await logAdminAction({
    admin,
    productType,
    action: "order.cancel",
    targetLabel: orderReference,
    targetId: orderId,
    reason,
  });

  after(() => sendOrderPush(orderId, "cancelled"));
  after(() => notifyOrdersChanged(productType));
  revalidateSite();
  return {};
}
