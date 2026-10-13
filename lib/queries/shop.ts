import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { cachedShopQuery } from "@/lib/data-cache";
import { Prisma } from "@/lib/generated/prisma/client";
import { sortBySize } from "@/lib/shop/size-order";
import {
  catalogueCountSql,
  catalogueIdsSql,
  colorFacetSql,
  priceFacetSql,
  sizeFacetSql,
  type CatalogueFilters,
  type FacetRow,
  type PriceFacetRow,
} from "@/lib/queries/catalogue-filters";

// Variants in the order the admin entered them (one product's variants are
// often created in the same instant, so the cuid breaks the tie). Without an
// orderBy Postgres returns them in no guaranteed order, and the API's
// `colors` list is meant to follow entry order.
const VARIANT_ENTRY_ORDER = [{ createdAt: "asc" }, { id: "asc" }] satisfies Prisma.ProductVariantOrderByWithRelationInput[];

// Once per request for the same arguments: the shop layout and the home and
// catalogue pages all want a boutique's whole catalogue.
// Cached across requests too (lib/data-cache.ts).
export const getActiveProducts = cache(cachedShopQuery("getActiveProducts", function getActiveProducts(
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
      variants: { orderBy: VARIANT_ENTRY_ORDER },
    },
    orderBy: { createdAt: "desc" },
    ...(options?.take ? { take: options.take } : {}),
  });
}));

// One page of a boutique's active catalogue, newest first, with the total the
// app needs to know when to stop scrolling (the website's grid loads it all).
export async function getActiveProductsPage(
  productType: string,
  { categoryId, page, pageSize }: { categoryId?: string; page: number; pageSize: number },
) {
  const where = { isActive: true, productType, ...(categoryId ? { categoryId } : {}) };
  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: true,
        images: { orderBy: { position: "asc" }, take: 1 },
        variants: { orderBy: VARIANT_ENTRY_ORDER },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ]);
  return { items, total };
}

// The mobile catalogue with sort and filters (lib/queries/catalogue-filters.ts):
// one page of ids in order, the filtered total, then the same rows as
// getActiveProductsPage for those ids.
export const getFilteredProductsPage = cachedShopQuery("getFilteredProductsPage", filteredProductsPage);

async function filteredProductsPage(
  filters: CatalogueFilters,
  { page, pageSize }: { page: number; pageSize: number },
) {
  const [ids, [{ total }]] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>(catalogueIdsSql(filters, page, pageSize)),
    prisma.$queryRaw<{ total: number }[]>(catalogueCountSql(filters)),
  ]);
  if (ids.length === 0) return { items: [], total };

  const products = await prisma.product.findMany({
    where: { id: { in: ids.map((row) => row.id) } },
    include: {
      category: true,
      images: { orderBy: { position: "asc" }, take: 1 },
      variants: { orderBy: VARIANT_ENTRY_ORDER },
    },
  });
  const byId = new Map(products.map((product) => [product.id, product]));
  return { items: ids.map((row) => byId.get(row.id)).filter((p) => p !== undefined), total };
}

// What the filter sheet offers: sizes (in size order) and colors (in entry
// order) of the scope, each with the products it would give, and the price
// range of what is in stock.
export async function getCatalogueFacets(filters: CatalogueFilters) {
  const [sizes, colors, [price]] = await Promise.all([
    prisma.$queryRaw<FacetRow[]>(sizeFacetSql(filters)),
    prisma.$queryRaw<FacetRow[]>(colorFacetSql(filters)),
    prisma.$queryRaw<PriceFacetRow[]>(priceFacetSql(filters)),
  ]);
  return {
    sizes: sortBySize(sizes, (row) => row.value).map(({ value, count }) => ({ value, count })),
    colors: colors.map(({ value, count }) => ({ value, count })),
    price: price && price.min !== null && price.max !== null ? { min: price.min, max: price.max } : null,
  };
}

// Whether a boutique has anything on sale, without loading it.
export const hasActiveProducts = cache(async function hasActiveProducts(productType: string) {
  return (await prisma.product.count({ where: { productType, isActive: true }, take: 1 })) > 0;
});

// The products of a customer's favorites list, on sale only.
export function getActiveProductsByIds(productType: string, ids: string[]) {
  return prisma.product.findMany({
    where: { id: { in: ids }, productType, isActive: true },
    include: {
      category: true,
      images: { orderBy: { position: "asc" }, take: 1 },
      variants: { orderBy: VARIANT_ENTRY_ORDER },
    },
  });
}

// Every color of a boutique's catalogue, for the filter sheet's swatches:
// what the color facet lists, alphabetically.
export const getCatalogueColors = cachedShopQuery("getCatalogueColors", catalogueColors);

async function catalogueColors(productType: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<FacetRow[]>(
    colorFacetSql({ productType, sort: "newest", sizes: [], colors: [] }),
  );
  return rows.map((row) => row.value).sort((a, b) => a.localeCompare(b));
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
      variants: { orderBy: VARIANT_ENTRY_ORDER },
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
export const getAllShopCategories = cache(
  cachedShopQuery("getAllShopCategories", (productType: string) =>
    prisma.category.findMany({
      where: { OR: [{ productType: null }, { productType }] },
      orderBy: [{ position: "asc" }, { name: "asc" }],
    }),
  ),
);

// Wrapped in React's per-request cache — generateMetadata and the page
// component below both call this for the same product, and without cache()
// that's two round trips to the DB instead of one.
// Variants come back sorted by size (S, M, L, XL — see sortBySize), then in
// entry order within a size, for both the product page and the mobile API.
export const getActiveProductBySlug = cache(cachedShopQuery("getActiveProductBySlug", async function getActiveProductBySlug(
  slug: string,
  productType: string,
) {
  const product = await prisma.product.findFirst({
    where: { slug, isActive: true, productType },
    include: {
      category: true,
      images: { orderBy: { position: "asc" } },
      variants: { orderBy: VARIANT_ENTRY_ORDER },
    },
  });
  if (!product) return null;
  return { ...product, variants: sortBySize(product.variants, (variant) => variant.size) };
}));

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
