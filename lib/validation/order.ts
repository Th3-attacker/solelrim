import { z } from "zod";

export const checkoutCustomerSchema = z.object({
  customerName: z.string().min(1, "required"),
  customerPhone: z.string().regex(/^[234]\d{7}$/, "invalidPhone"),
  customerCity: z.string().min(1, "required"),
});

export type CheckoutCustomerInput = z.infer<typeof checkoutCustomerSchema>;

// Collected at the payment step, separately from the customer's own contact
// number above — the mobile money transfer isn't always sent from the same
// line (a family member's phone, a different SIM), so the admin needs it
// on its own to match the screenshot to a transaction.
export const paymentSenderPhoneSchema = z.string().regex(/^[234]\d{7}$/, "invalidPhone");

export const orderItemInputSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
});

export const orderItemsSchema = z.array(orderItemInputSchema).min(1);

export const cancelReasonSchema = z.object({
  reason: z.string().min(1),
});

export const trackOrderSchema = z.object({
  phone: z.string().regex(/^[234]\d{7}$/, "invalidPhone"),
  reference: z.string().trim().min(1, "required"),
  productType: z.string().min(1),
});
