import { prisma } from "@/lib/prisma";

export function getAllSales() {
  return prisma.sale.findMany({
    include: { client: true, items: true },
    orderBy: { createdAt: "desc" },
  });
}

export function getSaleById(id: string) {
  return prisma.sale.findUnique({
    where: { id },
    include: {
      client: true,
      items: { include: { variant: { include: { product: true } } } },
    },
  });
}

export function getAllVariantsForSale() {
  return prisma.productVariant.findMany({
    include: { product: true },
    orderBy: [{ product: { name: "asc" } }],
  });
}
