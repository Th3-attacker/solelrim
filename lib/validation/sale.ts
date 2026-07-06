import { z } from "zod";

const emptyToNull = (val: unknown) =>
  val === "" || val === undefined ? null : val;

export const saleItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
});

export const saleSchema = z.object({
  clientId: z.preprocess(emptyToNull, z.string().nullable()),
  discount: z.coerce.number().min(0).default(0),
  paymentMethod: z.preprocess(emptyToNull, z.string().nullable()),
  notes: z.string().optional(),
  items: z.array(saleItemSchema).min(1),
});

export type SaleInput = z.infer<typeof saleSchema>;
