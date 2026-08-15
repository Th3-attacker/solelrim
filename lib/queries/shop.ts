import { cache } from "react";
import { prisma } from "@/lib/prisma";

export function getActiveProducts(
  productType: string,
  categoryId?: string,
  options?: { excludeId?: string; take?: number },
) {
  return prisma.product.findMany({
    where: {
      isActive: true,
      productType,
      ...(categoryId ? { categoryId } : {}),
      ...(options?.excludeId ? { id: { not: options.excludeId } } : {}),
    },
    include: {
      category: true,
      images: { orderBy: { position: "asc" }, take: 1 },
      variants: true,
    },
    orderBy: { createdAt: "desc" },
    ...(options?.take ? { take: options.take } : {}),
  });
}

// Wrapped in React's per-request cache — generateMetadata and the shop
// layout/products page below both call this for the same storeType, and
// without cache() that's an extra round trip to the DB per request.
export const getAllShopCategories = cache(function getAllShopCategories(
  productType: string,
) {
  return prisma.category.findMany({
    where: { OR: [{ productType: null }, { productType }] },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
});

// Wrapped in React's per-request cache — generateMetadata and the page
// component below both call this for the same product, and without cache()
// that's two round trips to the DB instead of one.
export const getActiveProductBySlug = cache(function getActiveProductBySlug(
  slug: string,
  productType: string,
) {
  return prisma.product.findFirst({
    where: { slug, isActive: true, productType },
    include: {
      category: true,
      images: { orderBy: { position: "asc" } },
      variants: { orderBy: [{ size: "asc" }, { color: "asc" }] },
    },
  });
});

// Legacy links shared before the slug migration still use the raw id —
// looked up regardless of isActive so an old link to a product that's since
// been deactivated still redirects to its (now 404-ing) canonical URL
// instead of a generic not-found with no further context.
// Scoped by productType — an id from a different boutique 404s like any
// other unknown product, instead of leaking that product's name/slug by
// redirecting to it.
export function getProductSlugById(id: string, productType: string) {
  return prisma.product.findFirst({ where: { id, productType }, select: { slug: true } });
}

// Walks the same order as the catalog grid (getActiveProducts) so "next" on
// the detail page matches what the customer would hit browsing the grid.
export async function getAdjacentProductSlugs(
  categoryId: string,
  currentProductId: string,
  productType: string,
): Promise<{ prevSlug: string | null; nextSlug: string | null }> {
  const siblings = await prisma.product.findMany({
    where: { isActive: true, categoryId, productType },
    select: { id: true, slug: true },
    orderBy: { createdAt: "desc" },
  });
  const index = siblings.findIndex((p) => p.id === currentProductId);
  if (index === -1) return { prevSlug: null, nextSlug: null };
  return {
    prevSlug: siblings[index - 1]?.slug ?? null,
    nextSlug: siblings[index + 1]?.slug ?? null,
  };
}
