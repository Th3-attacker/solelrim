import { prisma } from "@/lib/prisma";
import { toPageNumber } from "@/lib/shop/pagination";
import type { OrderStatus } from "@/lib/generated/prisma/client";

export type OrderListFilters = {
  productType: string;
  status?: OrderStatus;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
};

function buildOrdersWhere(filters: OrderListFilters) {
  const { productType, status, search, dateFrom, dateTo } = filters;
  return {
    productType,
    ...(status && { status }),
    ...(search && {
      OR: [
        { reference: { contains: search, mode: "insensitive" as const } },
        { customerPhone: { contains: search } },
      ],
    }),
    ...((dateFrom || dateTo) && {
      createdAt: {
        ...(dateFrom && { gte: dateFrom }),
        ...(dateTo && { lte: dateTo }),
      },
    }),
  };
}

export const ORDERS_PAGE_SIZE = 20;

export async function getAllOrders(filters: OrderListFilters, page = 1) {
  const currentPage = toPageNumber(page);
  const where = buildOrdersWhere(filters);

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: {
                  include: { images: { take: 1, orderBy: { position: "asc" } } },
                },
              },
            },
          },
        },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: (currentPage - 1) * ORDERS_PAGE_SIZE,
      take: ORDERS_PAGE_SIZE,
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, total };
}

// CSV export needs every order matching the current filters, not just the
// page on screen — a plain `select` (no items/variant/product/images join)
// keeps that full-set fetch cheap since the export never needs a thumbnail.
export function getAllOrdersForExport(filters: OrderListFilters) {
  return prisma.order.findMany({
    where: buildOrdersWhere(filters),
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
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

export const CLIENT_ORDERS_PAGE_SIZE = 20;

// Order has no Client relation — checkout is a guest flow, only ever
// collects name/phone/city — so a client's online order history can only
// be found by matching phone number, scoped to the same boutique. Paginated
// since that history can grow past a single page.
export async function getOrdersByPhonePage(
  phone: string,
  productType: string,
  page = 1,
) {
  const currentPage = toPageNumber(page);
  const where = { customerPhone: phone, productType };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * CLIENT_ORDERS_PAGE_SIZE,
      take: CLIENT_ORDERS_PAGE_SIZE,
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, total, page: currentPage };
}

// Powers the testimonial "link to a real order" picker — only ever offers
// delivered orders (the only status createTestimonial will actually accept
// as a link), and only this boutique's own.
export function getDeliveredOrders(productType: string) {
  return prisma.order.findMany({
    where: { productType, status: "DELIVERED" },
    select: { id: true, reference: true, customerName: true, deliveredAt: true },
    orderBy: { deliveredAt: "desc" },
  });
}

// Powers the sidebar's "Orders" badge — the only signal an admin gets of a
// new order besides the customer manually sending the pre-filled WhatsApp
// message from buildOrderWhatsAppLink, which nothing guarantees they do.
export function getPendingOrderCount(productType: string) {
  return prisma.order.count({ where: { productType, status: "PENDING" } });
}

export function getOrderById(id: string, productType: string) {
  return prisma.order.findFirst({
    where: { id, productType },
    include: {
      items: { include: { variant: { include: { product: true } } } },
    },
  });
}

// The order an earlier request with this Idempotency-Key created in this
// boutique, answered exactly like a fresh submit.
export async function findOrderByIdempotencyKey(
  productType: string,
  idempotencyKey: string,
): Promise<{ reference: string; orderId: string } | null> {
  const order = await prisma.order.findUnique({
    where: { productType_idempotencyKey: { productType, idempotencyKey } },
    select: { id: true, reference: true },
  });
  return order ? { reference: order.reference, orderId: order.id } : null;
}

// Other orders of this boutique sent with the very same screenshot (same
// SHA-256) — shown on the admin's order page as a possible fake payment.
export async function getOrdersSharingPaymentProof(order: {
  id: string;
  productType: string;
  paymentProofHash: string | null;
}): Promise<{ id: string; reference: string }[]> {
  if (!order.paymentProofHash) return [];
  return prisma.order.findMany({
    where: {
      productType: order.productType,
      paymentProofHash: order.paymentProofHash,
      id: { not: order.id },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, reference: true },
  });
}
