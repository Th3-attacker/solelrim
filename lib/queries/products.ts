import { prisma } from "@/lib/prisma";

export function getAllProducts(productType: string) {
  return prisma.product.findMany({
    where: { productType },
    include: {
      category: true,
      images: { orderBy: { position: "asc" }, take: 1 },
      variants: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export function getProductById(id: string, productType: string) {
  return prisma.product.findFirst({
    where: { id, productType },
    include: {
      images: { orderBy: { position: "asc" } },
      variants: { orderBy: [{ size: "asc" }, { color: "asc" }] },
    },
  });
}

export function getAllCategories(activeProductType?: string) {
  return prisma.category.findMany({
    where: activeProductType
      ? { OR: [{ productType: null }, { productType: activeProductType }] }
      : undefined,
    orderBy: { name: "asc" },
  });
}

export function getCategoryById(id: string) {
  return prisma.category.findUnique({ where: { id } });
}
