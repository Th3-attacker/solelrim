import { prisma } from "@/lib/prisma";
import type { OrderStatus } from "@/lib/generated/prisma/client";

export type OrderListFilters = {
  productType: string;
  status?: OrderStatus;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
};

export function getAllOrders(filters: OrderListFilters) {
  const { productType, status, search, dateFrom, dateTo } = filters;

  return prisma.order.findMany({
    where: {
      productType,
      ...(status && { status }),
      ...(search && {
        OR: [
          { reference: { contains: search, mode: "insensitive" } },
          { customerPhone: { contains: search } },
        ],
      }),
      ...((dateFrom || dateTo) && {
        createdAt: {
          ...(dateFrom && { gte: dateFrom }),
          ...(dateTo && { lte: dateTo }),
        },
      }),
    },
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
  });
}

// Order has no Client relation — checkout is a guest flow, only ever
// collects name/phone/city — so a client's online order history can only
// be found by matching phone number, scoped to the same boutique.
export function getOrdersByPhone(phone: string, productType: string) {
  return prisma.order.findMany({
    where: { customerPhone: phone, productType },
    orderBy: { createdAt: "desc" },
  });
}

export const CLIENT_ORDERS_PAGE_SIZE = 20;

// Paginated counterpart to getOrdersByPhone, for a client detail page whose
// online order history can grow past a single page.
export async function getOrdersByPhonePage(
  phone: string,
  productType: string,
  page = 1,
) {
  const currentPage = Math.max(1, page);
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

export function getOrderById(id: string, productType: string) {
  return prisma.order.findFirst({
    where: { id, productType },
    include: {
      items: { include: { variant: { include: { product: true } } } },
    },
  });
}
