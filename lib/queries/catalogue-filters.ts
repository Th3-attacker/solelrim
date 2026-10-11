import { Prisma } from "@/lib/generated/prisma/client";

// Sorting and filtering of the mobile catalogue (GET /api/v1/.../products
// with sort, sizes, colors, priceMin, priceMax or facets). Done in SQL so the
// page and its total are right whatever was loaded before: the app shows
// "See N items" from `total`.
//
// Size, color and price apply to one same variant, in stock: sizes=M and
// colors=Noir keep a product with a black M in stock, not one with a black S
// and a white M. A variant's price is its own, else the product's base price
// (lib/shop/price.ts).
//
// These functions only build the SQL; lib/queries/shop.ts runs it, and the
// tests run it on an in-memory Postgres.

export const CATALOGUE_SORTS = ["popular", "price_asc", "price_desc", "newest"] as const;
export type CatalogueSort = (typeof CATALOGUE_SORTS)[number];

export type CatalogueFilters = {
  productType: string;
  categoryId?: string;
  query?: string;
  sort: CatalogueSort;
  sizes: string[];
  colors: string[];
  priceMin?: number;
  priceMax?: number;
};

type VariantFilter = "sizes" | "colors" | "price";

const VARIANT_PRICE = Prisma.sql`COALESCE(v."price", p."basePrice")`;

// The products the request is about, before any variant filter: the facets'
// scope too.
function scope(filters: CatalogueFilters): Prisma.Sql {
  const conditions = [
    Prisma.sql`p."isActive" = true`,
    Prisma.sql`p."productType" = ${filters.productType}`,
  ];
  if (filters.categoryId) conditions.push(Prisma.sql`p."categoryId" = ${filters.categoryId}`);
  if (filters.query) {
    // Same match as searchActiveProducts (accent-insensitive).
    conditions.push(Prisma.sql`unaccent(lower(p."name")) ILIKE unaccent(lower(${`%${filters.query}%`}))`);
  }
  return Prisma.join(conditions, " AND ");
}

// Conditions on variant `v` for the active variant filters, but `omit` (a
// facet doesn't filter on itself).
function variantConditions(filters: CatalogueFilters, omit?: VariantFilter): Prisma.Sql[] {
  const conditions = [Prisma.sql`v."stock" > 0`];
  if (omit !== "sizes" && filters.sizes.length > 0) {
    conditions.push(Prisma.sql`v."size" IN (${Prisma.join(filters.sizes)})`);
  }
  if (omit !== "colors" && filters.colors.length > 0) {
    conditions.push(Prisma.sql`v."color" IN (${Prisma.join(filters.colors)})`);
  }
  if (omit !== "price" && filters.priceMin !== undefined) {
    conditions.push(Prisma.sql`${VARIANT_PRICE} >= ${filters.priceMin}`);
  }
  if (omit !== "price" && filters.priceMax !== undefined) {
    conditions.push(Prisma.sql`${VARIANT_PRICE} <= ${filters.priceMax}`);
  }
  return conditions;
}

function hasVariantFilter(filters: CatalogueFilters): boolean {
  return (
    filters.sizes.length > 0 ||
    filters.colors.length > 0 ||
    filters.priceMin !== undefined ||
    filters.priceMax !== undefined
  );
}

function matching(filters: CatalogueFilters): Prisma.Sql {
  if (!hasVariantFilter(filters)) return scope(filters);
  return Prisma.sql`${scope(filters)} AND EXISTS (
    SELECT 1 FROM "ProductVariant" v
    WHERE v."productId" = p."id" AND ${Prisma.join(variantConditions(filters), " AND ")}
  )`;
}

// price.min / price.max as the app shows them: over every variant, in stock
// or not (getPriceRange), the base price for a product without variants.
const PRICE_MIN = Prisma.sql`COALESCE((SELECT MIN(${VARIANT_PRICE}) FROM "ProductVariant" v WHERE v."productId" = p."id"), p."basePrice")`;
const PRICE_MAX = Prisma.sql`COALESCE((SELECT MAX(${VARIANT_PRICE}) FROM "ProductVariant" v WHERE v."productId" = p."id"), p."basePrice")`;

// Ties fall back to the catalogue's order (newest first), then the id, so a
// page never repeats or skips a product.
const ORDER_BY: Record<CatalogueSort, Prisma.Sql> = {
  popular: Prisma.sql`p."isFeatured" DESC, p."createdAt" DESC, p."id" DESC`,
  newest: Prisma.sql`p."createdAt" DESC, p."id" DESC`,
  price_asc: Prisma.sql`${PRICE_MIN} ASC, p."createdAt" DESC, p."id" DESC`,
  price_desc: Prisma.sql`${PRICE_MAX} DESC, p."createdAt" DESC, p."id" DESC`,
};

export function catalogueIdsSql(filters: CatalogueFilters, page: number, pageSize: number): Prisma.Sql {
  return Prisma.sql`
    SELECT p."id" FROM "Product" p
    WHERE ${matching(filters)}
    ORDER BY ${ORDER_BY[filters.sort]}
    LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
  `;
}

export function catalogueCountSql(filters: CatalogueFilters): Prisma.Sql {
  return Prisma.sql`SELECT COUNT(*)::int AS "total" FROM "Product" p WHERE ${matching(filters)}`;
}

// Facets: every value in scope (in stock or not), each with the number of
// products it would give alongside the other active filters. `first` is
// when the value was first entered, for the colors' order.
function facetSql(column: "size" | "color", filters: CatalogueFilters): Prisma.Sql {
  const omit = column === "size" ? "sizes" : "colors";
  return Prisma.sql`
    SELECT v.${Prisma.raw(`"${column}"`)} AS "value",
      COUNT(DISTINCT p."id") FILTER (WHERE ${Prisma.join(variantConditions(filters, omit), " AND ")})::int AS "count",
      MIN(v."createdAt") AS "first"
    FROM "Product" p JOIN "ProductVariant" v ON v."productId" = p."id"
    WHERE ${scope(filters)}
    GROUP BY v.${Prisma.raw(`"${column}"`)}
    ORDER BY "first" ASC, "value" ASC
  `;
}

export function sizeFacetSql(filters: CatalogueFilters): Prisma.Sql {
  return facetSql("size", filters);
}

export function colorFacetSql(filters: CatalogueFilters): Prisma.Sql {
  return facetSql("color", filters);
}

export function priceFacetSql(filters: CatalogueFilters): Prisma.Sql {
  return Prisma.sql`
    SELECT MIN(${VARIANT_PRICE})::float8 AS "min", MAX(${VARIANT_PRICE})::float8 AS "max"
    FROM "Product" p JOIN "ProductVariant" v ON v."productId" = p."id"
    WHERE ${scope(filters)} AND ${Prisma.join(variantConditions(filters, "price"), " AND ")}
  `;
}

export type FacetRow = { value: string; count: number };
export type PriceFacetRow = { min: number | null; max: number | null };
