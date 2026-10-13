import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Private bucket: a payment screenshot is only ever shown to an admin, through
// a link that expires.
export const PAYMENT_PROOFS_BUCKET = "payment-proofs";

export async function getSignedPaymentProofUrl(storagePath: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(PAYMENT_PROOFS_BUCKET)
    .createSignedUrl(storagePath, 60 * 5);
  return error ? null : data.signedUrl;
}
