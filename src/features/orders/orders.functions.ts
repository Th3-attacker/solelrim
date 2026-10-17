import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { OrderStatus, Prisma } from "@/lib/generated/prisma/client";
import { recordAdminAction } from "@/lib/audit-log";
import { parseOrderDateFilters } from "@/lib/orders/filters";
import { sendOrderPush } from "@/lib/push/order-push";
import { notifyOrdersChanged } from "@/lib/realtime";
import { getOrdersSharingPaymentProof } from "@/lib/queries/orders";
import {
  buildClientConfirmationMessage,
  buildClientDeliveredMessage,
  buildClientRejectionMessage,
  buildClientShippedMessage,
  buildClientWhatsAppLink,
} from "@/lib/shop/client-messages";
import { STALE_PENDING_HOURS } from "@/lib/shop/order-status";
import {
  cancelOrderTransition,
  confirmOrderTransition,
  deliverOrderTransition,
  rejectOrderTransition,
  shipOrderTransition,
  type OrderTransitionResult,
} from "@/lib/services/order-transitions";
import type { AuditAction } from "@/lib/audit-actions";
import type { OrderPushEvent } from "@/lib/shop/client-messages";
import { getSignedPaymentProofUrl } from "@/lib/supabase/payment-proofs";
import { adminMiddleware, writableAdminMiddleware } from "~/server/admin-middleware";
import { afterResponse } from "~/server/after-response";
import {
  ORDERS_PAGE_SIZE,
  ORDER_TAB_STATUS,
  cancelOrderSchema,
  orderIdSchema,
  orderListSearchSchema,
  rejectOrderSchema,
  type OrderTab,
} from "./orders.schemas";

// The admin's orders: reading the list, one order, its labels; moving an
// order along. Every one checks the caller and reads the boutique they're
// acting on from the session, never from the request.

function listWhere(
  productType: string,
  filters: { q?: string; from?: string; to?: string },
): Prisma.OrderWhereInput {
  const { dateFrom, dateTo } = parseOrderDateFilters(filters);
  return {
    productType,
    ...(filters.q && {
      OR: [
        { reference: { contains: filters.q, mode: "insensitive" } },
        { customerPhone: { contains: filters.q.replace(/\s/g, "") } },
      ],
    }),
    ...((dateFrom || dateTo) && {
      createdAt: { ...(dateFrom && { gte: dateFrom }), ...(dateTo && { lte: dateTo }) },
    }),
  };
}

export const listOrders = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .validator(orderListSearchSchema)
  .handler(async ({ context: { productType }, data: filters }) => {
    const base = listWhere(productType, filters);
    const where =
      filters.status === "all" ? base : { ...base, status: ORDER_TAB_STATUS[filters.status] };

    const [rows, total, byStatus] = await Promise.all([
      prisma.order.findMany({
        where,
        // The oldest payments to check first in their tab; otherwise newest.
        orderBy: { createdAt: filters.status === "pending" ? "asc" : "desc" },
        skip: (filters.page - 1) * ORDERS_PAGE_SIZE,
        take: ORDERS_PAGE_SIZE,
        select: {
          id: true,
          reference: true,
          customerName: true,
          customerPhone: true,
          total: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.order.count({ where }),
      // The tabs' counters, for the same search and dates.
      prisma.order.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
    ]);

    const counts = Object.fromEntries(
      byStatus.map((group) => [group.status, group._count._all]),
    ) as Partial<Record<OrderStatus, number>>;
    const tabCounts: Record<OrderTab, number> = {
      all: byStatus.reduce((sum, group) => sum + group._count._all, 0),
      pending: counts.PENDING ?? 0,
      confirmed: counts.CONFIRMED ?? 0,
      shipping: counts.SHIPPING ?? 0,
      delivered: counts.DELIVERED ?? 0,
      rejected: counts.REJECTED ?? 0,
      cancelled: counts.CANCELLED ?? 0,
    };

    return {
      now: new Date(),
      staleAfterHours: STALE_PENDING_HOURS,
      rows: rows.map((row) => ({ ...row, total: row.total.toNumber() })),
      total,
      pageSize: ORDERS_PAGE_SIZE,
      tabCounts,
    };
  });

// Everything the list's filters match (or the ticked orders), for a CSV.
// Read on demand, not with every page of the list.
export const exportOrders = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .validator(
    z.union([
      z.object({ ids: z.array(z.string().min(1)).min(1).max(500) }),
      orderListSearchSchema.omit({ page: true }),
    ]),
  )
  .handler(async ({ context: { productType }, data }) => {
    const where: Prisma.OrderWhereInput =
      "ids" in data
        ? { productType, id: { in: data.ids } }
        : data.status === "all"
          ? listWhere(productType, data)
          : { ...listWhere(productType, data), status: ORDER_TAB_STATUS[data.status] };

    const rows = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 5000,
      select: {
        reference: true,
        customerName: true,
        customerPhone: true,
        customerCity: true,
        paymentSenderPhone: true,
        total: true,
        status: true,
        createdAt: true,
      },
    });
    return rows.map((row) => ({ ...row, total: row.total.toNumber() }));
  });

// The message the customer gets on WhatsApp at this stage, in the language
// they ordered in, ready to send from the admin's phone.
function whatsappLinkFor(order: {
  status: OrderStatus;
  locale: string | null;
  customerName: string;
  customerPhone: string;
  reference: string;
  total: number;
  rejectReason: string | null;
}): string | null {
  const base = {
    locale: order.locale,
    customerName: order.customerName,
    reference: order.reference,
  };
  const message =
    order.status === "CONFIRMED"
      ? buildClientConfirmationMessage({ ...base, total: order.total })
      : order.status === "SHIPPING"
        ? buildClientShippedMessage(base)
        : order.status === "DELIVERED"
          ? buildClientDeliveredMessage(base)
          : order.status === "REJECTED" && order.rejectReason
            ? buildClientRejectionMessage({ ...base, reason: order.rejectReason })
            : null;
  return message ? buildClientWhatsAppLink(order.customerPhone, message) : null;
}

export const getOrder = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .validator(orderIdSchema)
  .handler(async ({ context: { productType }, data: { orderId } }) => {
    const order = await prisma.order.findFirst({
      where: { id: orderId, productType },
      include: {
        promoCode: { select: { code: true } },
        items: {
          include: {
            variant: {
              select: { size: true, color: true, product: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });
    if (!order) return null;

    const [proofUrl, proofSharedWith, ordersFromPhone] = await Promise.all([
      getSignedPaymentProofUrl(order.paymentProofPath),
      getOrdersSharingPaymentProof(order),
      prisma.order.count({ where: { productType, customerPhone: order.customerPhone } }),
    ]);
    const total = order.total.toNumber();

    return {
      now: new Date(),
      staleAfterHours: STALE_PENDING_HOURS,
      id: order.id,
      reference: order.reference,
      status: order.status,
      createdAt: order.createdAt,
      confirmedAt: order.confirmedAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      rejectedAt: order.rejectedAt,
      cancelledAt: order.cancelledAt,
      rejectReason: order.rejectReason,
      cancelReason: order.cancelReason,
      customer: {
        name: order.customerName,
        phone: order.customerPhone,
        city: order.customerCity,
        ordersFromPhone,
      },
      payment: {
        proofUrl,
        proofSharedWith,
        senderPhone: order.paymentSenderPhone,
        transactionId: order.paymentTransactionId,
      },
      items: order.items.map((item) => ({
        id: item.id,
        name: item.variant.product.name,
        size: item.variant.size,
        color: item.variant.color,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toNumber(),
        lineTotal: item.lineTotal.toNumber(),
      })),
      subtotal: order.subtotal.toNumber(),
      discount: order.discount.toNumber(),
      promoCode: order.promoCode?.code ?? null,
      total,
      whatsappLink: whatsappLinkFor({ ...order, total }),
    };
  });

// What the 10 × 15 cm labels show, for one order or a ticked selection.
export const getOrderLabels = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .validator(z.object({ ids: z.array(z.string().min(1)).min(1).max(100) }))
  .handler(async ({ context: { productType }, data: { ids } }) => {
    const [orders, boutique] = await Promise.all([
      prisma.order.findMany({
        where: { productType, id: { in: ids } },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          reference: true,
          customerName: true,
          customerPhone: true,
          customerCity: true,
          total: true,
          confirmedAt: true,
          createdAt: true,
          items: { select: { quantity: true } },
        },
      }),
      prisma.storeType.findUnique({
        where: { key: productType },
        select: { label: true, siteName: true, adminWhatsappNumber: true },
      }),
    ]);
    return {
      sender: {
        name: boutique?.siteName || boutique?.label || "SOLAL",
        whatsapp: boutique?.adminWhatsappNumber ?? null,
      },
      orders: orders.map((order) => ({
        id: order.id,
        reference: order.reference,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerCity: order.customerCity,
        total: order.total.toNumber(),
        date: order.confirmedAt ?? order.createdAt,
        itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      })),
    };
  });

// Moving an order along. The transition itself is shared with the Next.js
// build (lib/services/order-transitions.ts); then the audit line, and after
// the response, the push to the customer's app and the live refresh.
async function afterTransition(
  result: OrderTransitionResult,
  {
    orderId,
    productType,
    actor,
    action,
    push,
    reason,
  }: {
    orderId: string;
    productType: string;
    actor: Parameters<typeof recordAdminAction>[0];
    action: AuditAction;
    push: OrderPushEvent;
    reason?: string;
  },
) {
  if ("error" in result) return result;
  await recordAdminAction(actor, {
    productType,
    action,
    targetLabel: result.reference,
    targetId: orderId,
    reason,
  });
  afterResponse("order push", () => sendOrderPush(orderId, push));
  afterResponse("orders live refresh", () => notifyOrdersChanged(productType));
  return result;
}

export const confirmOrder = createServerFn({ method: "POST" })
  .middleware([writableAdminMiddleware])
  .validator(orderIdSchema)
  .handler(async ({ context: { productType, actor }, data: { orderId } }) =>
    afterTransition(await confirmOrderTransition(orderId, productType), {
      orderId,
      productType,
      actor,
      action: "order.confirm",
      push: "confirmed",
    }),
  );

export const rejectOrder = createServerFn({ method: "POST" })
  .middleware([writableAdminMiddleware])
  .validator(rejectOrderSchema)
  .handler(async ({ context: { productType, actor }, data: { orderId, reason } }) =>
    afterTransition(await rejectOrderTransition(orderId, productType, reason), {
      orderId,
      productType,
      actor,
      action: "order.reject",
      push: "rejected",
      reason,
    }),
  );

export const shipOrder = createServerFn({ method: "POST" })
  .middleware([writableAdminMiddleware])
  .validator(orderIdSchema)
  .handler(async ({ context: { productType, actor }, data: { orderId } }) =>
    afterTransition(await shipOrderTransition(orderId, productType), {
      orderId,
      productType,
      actor,
      action: "order.ship",
      push: "shipped",
    }),
  );

export const deliverOrder = createServerFn({ method: "POST" })
  .middleware([writableAdminMiddleware])
  .validator(orderIdSchema)
  .handler(async ({ context: { productType, actor }, data: { orderId } }) =>
    afterTransition(await deliverOrderTransition(orderId, productType), {
      orderId,
      productType,
      actor,
      action: "order.deliver",
      push: "delivered",
    }),
  );

export const cancelOrder = createServerFn({ method: "POST" })
  .middleware([writableAdminMiddleware])
  .validator(cancelOrderSchema)
  .handler(async ({ context: { productType, actor }, data: { orderId, reason } }) =>
    afterTransition(await cancelOrderTransition(orderId, productType, reason), {
      orderId,
      productType,
      actor,
      action: "order.cancel",
      push: "cancelled",
      reason,
    }),
  );
