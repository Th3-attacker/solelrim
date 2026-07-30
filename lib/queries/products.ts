import { prisma } from "@/lib/prisma";

export function getAllProducts() {
  return prisma.product.findMany({
    include: {
      category: true,
      images: { orderBy: { position: "asc" }, take: 1 },
      variants: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export function getProductById(id: string) {
  return prisma.product.findUnique({
    where: { id },
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
