"use server";

import { searchActiveProducts } from "@/lib/queries/shop";
import { getProductImageUrl } from "@/lib/supabase/storage";
import { getPriceRange } from "@/lib/shop/price";

export type SearchProductSuggestion = {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  price: number;
};

const MAX_SUGGESTIONS = 6;

// Backs the header search box's live suggestions. Public and unauthenticated
// like any other storefront catalog read — productType only scopes which
// boutique's own active products are searched, the same data a visitor
// could already reach by browsing that boutique's /products page.
export async function searchProductSuggestions(
  productType: string,
  query: string,
): Promise<SearchProductSuggestion[]> {
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
