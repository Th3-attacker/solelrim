import { createAdminClient } from "@/lib/supabase/admin";

const PRODUCT_IMAGES_BUCKET = "product-images";
const PAYMENT_PROOFS_BUCKET = "payment-proofs";

export function getProductImageUrl(storagePath: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${storagePath}`;
}

export function getStoreLogoUrl(storagePath: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${storagePath}`;
}

export function getStoreHeroImageUrl(storagePath: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${storagePath}`;
}

export async function getSignedPaymentProofUrl(
  storagePath: string,
): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(PAYMENT_PROOFS_BUCKET)
    .createSignedUrl(storagePath, 60 * 5);
  return error ? null : data.signedUrl;
}
