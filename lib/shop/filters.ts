import { getPriceRange } from "@/lib/shop/price";
import type { getActiveProducts } from "@/lib/queries/shop";

type Product = Awaited<ReturnType<typeof getActiveProducts>>[number];

export const SORT_OPTIONS = [
  { value: "default", labelKey: "sortDefault" },
  { value: "newest", labelKey: "sortNewest" },
  { value: "price-asc", labelKey: "sortPriceAsc" },
  { value: "price-desc", labelKey: "sortPriceDesc" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

// Bucket boundaries are tuned to this catalog's actual price spread (tens to
// low thousands of MRU), not a generic $0-200 scale.
export const PRICE_BUCKETS = [
  { value: "0-50", min: 0, max: 50 },
  { value: "50-100", min: 50, max: 100 },
  { value: "100-500", min: 100, max: 500 },
  { value: "500-2000", min: 500, max: 2000 },
  { value: "2000+", min: 2000, max: Infinity },
] as const;

export function productPrice(product: Product): number {
  return getPriceRange(product.variants, product.basePrice).min;
}

export function filterByPriceBucket(
  products: Product[],
  bucketValue: string,
): Product[] {
  const bucket = PRICE_BUCKETS.find((b) => b.value === bucketValue);
  if (!bucket) return products;
  return products.filter((p) => {
    const price = productPrice(p);
    return price >= bucket.min && price < bucket.max;
  });
}

export function filterByColor(products: Product[], color: string): Product[] {
  return products.filter((p) => p.variants.some((v) => v.color === color));
}

export function sortProducts(products: Product[], sort?: string): Product[] {
  const sorted = [...products];
  switch (sort) {
    case "newest":
      return sorted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    case "price-asc":
      return sorted.sort((a, b) => productPrice(a) - productPrice(b));
    case "price-desc":
      return sorted.sort((a, b) => productPrice(b) - productPrice(a));
    default:
      return sorted;
  }
}

export function getAllCatalogColors(products: Product[]): string[] {
  return [...new Set(products.flatMap((p) => p.variants.map((v) => v.color)))].sort();
}
