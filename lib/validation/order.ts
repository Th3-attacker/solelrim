import { z } from "zod";

export const checkoutCustomerSchema = z.object({
  customerName: z.string().min(1),
  customerPhone: z.string().regex(/^\d{6,15}$/, "invalidPhone"),
  customerCity: z.string().min(1),
});

export type CheckoutCustomerInput = z.infer<typeof checkoutCustomerSchema>;

export const orderItemInputSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
});

export const orderItemsSchema = z.array(orderItemInputSchema).min(1);

export const cancelReasonSchema = z.object({
  reason: z.string().min(1),
});
