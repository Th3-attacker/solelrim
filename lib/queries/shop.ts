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

// Walks the same order as the catalog grid (getActiveProducts) so "next" on
// the detail page matches what the customer would hit browsing the grid.
export async function getAdjacentProductIds(
  categoryId: string,
  currentProductId: string,
): Promise<{ prevId: string | null; nextId: string | null }> {
  const siblings = await prisma.product.findMany({
    where: { isActive: true, categoryId },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  const index = siblings.findIndex((p) => p.id === currentProductId);
  if (index === -1) return { prevId: null, nextId: null };
  return {
    prevId: siblings[index - 1]?.id ?? null,
    nextId: siblings[index + 1]?.id ?? null,
  };
}
