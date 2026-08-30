"use server";

import { searchActiveProducts } from "@/lib/queries/shop";
import { getProductImageUrl } from "@/lib/supabase/storage";
import { getPriceRange } from "@/lib/shop/price";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export type SearchProductSuggestion = {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  price: number;
};

const MAX_SUGGESTIONS = 6;

// Fires once per (debounced) keystroke in the header search box — public and
// unauthenticated. searchActiveProducts runs an `unaccent(lower(name)) ILIKE
// '%...%'` query whose leading wildcard can't use an index, so an uncapped
// caller is a cheap way to load the DB. Generous window sized for real
// typing, not an abuse-tight one.
const SEARCH_RATE_LIMIT = { windowMs: 15 * 60 * 1000, max: 40 };

// Backs the header search box's live suggestions. Public and unauthenticated
// like any other storefront catalog read — productType only scopes which
// boutique's own active products are searched, the same data a visitor
// could already reach by browsing that boutique's /products page.
export async function searchProductSuggestions(
  productType: string,
  query: string,
): Promise<SearchProductSuggestion[]> {
  if (!query.trim()) return [];

  const ip = await getClientIp();
  const allowed = await checkRateLimit(`search:${ip}`, SEARCH_RATE_LIMIT);
  if (!allowed) return [];

  const products = await searchActiveProducts(productType, query, {
    take: MAX_SUGGESTIONS,
  });
  return products.map((product) => ({
    id: product.id,
    slug: product.slug,
    name: product.name,
    imageUrl: product.images[0] ? getProductImageUrl(product.images[0].storagePath) : null,
    price: getPriceRange(product.variants, product.basePrice).min,
  }));
}
