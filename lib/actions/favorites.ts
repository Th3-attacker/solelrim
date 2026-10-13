"use server";

import { getActiveProductsByIds } from "@/lib/queries/shop";
import { getPriceRange } from "@/lib/shop/price";
import { getProductImageUrl } from "@/lib/supabase/storage";

export type FavoriteProductSummary = {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  price: number;
};

// A customer's favorites are ids in their browser; this resolves them to what
// the drawer shows when it opens, instead of every page shipping the whole
// catalogue. Public data, capped like a cart.
export async function getFavoriteProducts(
  productType: string,
  ids: string[],
): Promise<FavoriteProductSummary[]> {
  const wanted = ids.filter((id) => typeof id === "string").slice(0, 100);
  if (wanted.length === 0) return [];
  const products = await getActiveProductsByIds(productType, wanted);
  return products.map((product) => ({
    id: product.id,
    slug: product.slug,
    name: product.name,
    imageUrl: product.images[0] ? getProductImageUrl(product.images[0].storagePath) : null,
    price: getPriceRange(product.variants, product.basePrice).min,
  }));
}
