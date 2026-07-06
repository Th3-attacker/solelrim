import { prisma } from "@/lib/prisma";

export function getActiveProducts(categoryId?: string) {
  return prisma.product.findMany({
    where: { isActive: true, ...(categoryId ? { categoryId } : {}) },
    include: {
      category: true,
      images: { orderBy: { position: "asc" }, take: 1 },
      variants: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export function getAllShopCategories() {
  return prisma.category.findMany({ orderBy: { name: "asc" } });
}

export function getActiveProductById(id: string) {
  return prisma.product.findFirst({
    where: { id, isActive: true },
    include: {
      category: true,
      images: { orderBy: { position: "asc" } },
      variants: { orderBy: [{ size: "asc" }, { color: "asc" }] },
    },
  });
}
