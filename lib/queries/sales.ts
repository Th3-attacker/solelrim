import { prisma } from "@/lib/prisma";

export function getAllSales(productType: string) {
  return prisma.sale.findMany({
    where: { productType },
    include: { client: true, items: true },
    orderBy: { createdAt: "desc" },
  });
}

export function getSaleById(id: string, productType: string) {
  return prisma.sale.findFirst({
    where: { id, productType },
    include: {
      client: true,
      items: { include: { variant: { include: { product: true } } } },
    },
  });
}

export function getAllVariantsForSale(productType: string) {
  return prisma.productVariant.findMany({
    where: { product: { productType } },
    include: { product: true },
    orderBy: [{ product: { name: "asc" } }],
  });
}
