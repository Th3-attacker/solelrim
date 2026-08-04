import { z } from "zod";

export const checkoutCustomerSchema = z.object({
  customerName: z.string().min(1, "required"),
  customerPhone: z.string().regex(/^[234]\d{7}$/, "invalidPhone"),
  customerCity: z.string().min(1, "required"),
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
