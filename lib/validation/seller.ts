import { z } from "zod";

// No productType field on purpose: a seller is always created in the
// acting admin's own boutique (lib/actions/sellers.ts), never one the
// request names.
export const sellerInputSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
});

export const sellerQuotaSchema = z.coerce.number().int().min(0).max(50);
