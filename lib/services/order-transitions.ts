import "server-only";
import { prisma } from "@/lib/prisma";
import { cancelReasonSchema } from "@/lib/validation/order";
import { buildSaleReference } from "@/lib/shop/reference";
import { PrismaClientKnownRequestError } from "@/lib/generated/prisma/internal/prismaNamespace";

// What moving an order along does to the database, free of any framework:
// the caller has already checked who may (and in which boutique), and does
// the rest itself (audit line, push to the customer, live refresh). Used by
// lib/actions/orders.ts (Next.js) and the TanStack Start admin.

export type OrderTransitionError =
  "notFound" | "notPending" | "invalidTransition" | "invalid" | "referenceCollision";

export type OrderTransitionResult = { reference: string } | { error: OrderTransitionError };

export async function confirmOrderTransition(
  orderId: string,
  productType: string,
): Promise<OrderTransitionResult> {
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
      return { error: err.message as OrderTransitionError };
    }
    throw err;
  }

  return { reference: orderReference };
}

export async function rejectOrderTransition(
  orderId: string,
  productType: string,
  reason: string,
): Promise<OrderTransitionResult> {
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
      return { error: err.message as OrderTransitionError };
    }
    throw err;
  }

  return { reference: orderReference };
}

export async function shipOrderTransition(
  orderId: string,
  productType: string,
): Promise<OrderTransitionResult> {
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
  return { reference: order?.reference ?? orderId };
}

// Best-sellers on the storefront (Product.isFeatured) are recalculated from
// scratch every time an order is delivered, rather than left as a manual
// admin checkbox — the top N products by total delivered quantity become
// the featured set, everyone else loses the badge.
const BEST_SELLER_COUNT = 5;

export async function deliverOrderTransition(
  orderId: string,
  productType: string,
): Promise<OrderTransitionResult> {
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
      return { error: err.message as OrderTransitionError };
    }
    throw err;
  }

  return { reference: orderReference };
}

export async function cancelOrderTransition(
  orderId: string,
  productType: string,
  reason: string,
): Promise<OrderTransitionResult> {
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
      return { error: err.message as OrderTransitionError };
    }
    throw err;
  }

  return { reference: orderReference };
}
