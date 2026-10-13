import type { CatalogueFilters, CatalogueSort } from "@/lib/queries/catalogue-filters";

export const SORT_OPTIONS = [
  { value: "default", labelKey: "sortDefault" },
  { value: "newest", labelKey: "sortNewest" },
  { value: "price-asc", labelKey: "sortPriceAsc" },
  { value: "price-desc", labelKey: "sortPriceDesc" },
] as const;

// Bucket boundaries are tuned to this catalog's actual price spread (tens to
// low thousands of MRU), not a generic $0-200 scale.
export const PRICE_BUCKETS = [
  { value: "0-50", min: 0, max: 50 },
  { value: "50-100", min: 50, max: 100 },
  { value: "100-500", min: 100, max: 500 },
  { value: "500-2000", min: 500, max: 2000 },
  { value: "2000+", min: 2000, max: Infinity },
] as const;

// The website's ?sort= values in the catalogue's own vocabulary, the one the
// app's API speaks (lib/queries/catalogue-filters.ts). "default" keeps the
// catalogue's order, newest first.
const SORT_BY_OPTION: Record<string, CatalogueSort> = {
  default: "newest",
  newest: "newest",
  "price-asc": "price_asc",
  "price-desc": "price_desc",
};

export type CatalogueSearch = {
  category?: string;
  sort?: string;
  price?: string;
  color?: string;
  q?: string;
};

// The /products page's search params as the SQL filters the app's catalogue
// uses too: one implementation of sorting and filtering, done in the
// database, paginated. Like the app's, a color or price filter keeps the
// products with a matching variant in stock.
export function catalogueFiltersFromSearch(
  productType: string,
  { category, sort, price, color, q }: CatalogueSearch,
): CatalogueFilters {
  const bucket = PRICE_BUCKETS.find((candidate) => candidate.value === price);
  return {
    productType,
    categoryId: category || undefined,
    query: q?.trim() || undefined,
    sort: SORT_BY_OPTION[sort ?? "default"] ?? "newest",
    sizes: [],
    colors: color ? [color] : [],
    priceMin: bucket?.min,
    // A bucket's upper bound belongs to the next one: 50 is in "50-100".
    priceMax: bucket && Number.isFinite(bucket.max) ? bucket.max - 0.01 : undefined,
  };
}
