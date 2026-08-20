import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";

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

// Accent-insensitive product name search, done in the database via the
// unaccent extension (prisma/migrations/20260820110000_enable_unaccent)
// instead of fetching the whole active catalog and filtering it in JS —
// that doesn't scale once a boutique's catalog grows past a few dozen
// products, since every page load (and every keystroke in the search box)
// would ship and re-scan the entire thing. $queryRaw only gets ids back
// (Prisma can't express unaccent() in a normal `where`), then a second,
// ordinary findMany hydrates just those rows with their relations.
export async function searchActiveProducts(
  productType: string,
  query: string,
  options?: { categoryId?: string; take?: number },
) {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const take = options?.take ?? 20;
  const pattern = `%${trimmed}%`;

  const matches = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Product"
    WHERE "productType" = ${productType}
      AND "isActive" = true
      ${options?.categoryId ? Prisma.sql`AND "categoryId" = ${options.categoryId}` : Prisma.empty}
      AND unaccent(lower(name)) ILIKE unaccent(lower(${pattern}))
    ORDER BY "createdAt" DESC
    LIMIT ${take}
  `;
  if (matches.length === 0) return [];

  const products = await prisma.product.findMany({
    where: { id: { in: matches.map((m) => m.id) } },
    include: {
      category: true,
      images: { orderBy: { position: "asc" }, take: 1 },
      variants: true,
    },
  });

  // findMany({ id: { in } }) doesn't preserve that list's order — restore
  // the raw query's order (newest match first) instead of DB-arbitrary.
  const byId = new Map(products.map((product) => [product.id, product]));
  return matches.map((match) => byId.get(match.id)).filter((p) => p !== undefined);
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
