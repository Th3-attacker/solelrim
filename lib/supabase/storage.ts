// Public URLs of what the product-images bucket holds (product photos, logos,
// hero images, wallet logos). Pure string building, so client components use
// it too — keep anything needing a Supabase client out of this file (signed
// URLs live in lib/supabase/payment-proofs.ts).
const PRODUCT_IMAGES_BUCKET = "product-images";

function publicImageUrl(storagePath: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${storagePath}`;
}

export const getProductImageUrl = publicImageUrl;
export const getStoreLogoUrl = publicImageUrl;
export const getStoreHeroImageUrl = publicImageUrl;
export const getWalletLogoUrl = publicImageUrl;
