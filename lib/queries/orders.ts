import { prisma } from "@/lib/prisma";
import type { OrderStatus } from "@/lib/generated/prisma/client";

export type OrderListFilters = {
  status?: OrderStatus;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
};

export function getAllOrders(filters: OrderListFilters = {}) {
  const { status, search, dateFrom, dateTo } = filters;

  return prisma.order.findMany({
    where: {
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

export function getOrderById(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { variant: { include: { product: true } } } },
    },
  });
}
