import { z } from "zod";

export const refundRequestSchema = z.object({
  saleId: z.string().min(1),
  // Units per sale line; lines left out aren't refunded.
  items: z
    .array(z.object({ saleItemId: z.string().min(1), quantity: z.number().int().min(1) }))
    .min(1)
    .max(200),
  reason: z.string().trim().min(3).max(500),
});

export const refundDecisionSchema = z.object({
  requestId: z.string().min(1),
});

export const refundRejectionSchema = z.object({
  requestId: z.string().min(1),
  reason: z.string().trim().min(3).max(500),
});
