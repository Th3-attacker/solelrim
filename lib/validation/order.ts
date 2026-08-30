import { z } from "zod";

// Public, unauthenticated checkout input — the max lengths are a DB-bloat
// backstop (a real name/city is well under this), not a UX constraint. An
// over-limit value falls through to the form's generic "check your info"
// message, same as any other validation miss.
export const checkoutCustomerSchema = z.object({
  customerName: z.string().min(1, "required").max(120),
  customerPhone: z.string().regex(/^[234]\d{7}$/, "invalidPhone"),
  customerCity: z.string().min(1, "required").max(120),
});

export type CheckoutCustomerInput = z.infer<typeof checkoutCustomerSchema>;

// Collected at the payment step, separately from the customer's own contact
// number above — the mobile money transfer isn't always sent from the same
// line (a family member's phone, a different SIM), so the admin needs it
// on its own to match the screenshot to a transaction.
export const paymentSenderPhoneSchema = z.string().regex(/^[234]\d{7}$/, "invalidPhone");

export const orderItemInputSchema = z.object({
  variantId: z.string().min(1),
  // Upper bound is a sanity ceiling well above any real stock level — the
  // atomic `stock: { gte: quantity }` guard in submitOrder is what actually
  // enforces availability; this just stops an absurd value from reaching
  // the price arithmetic / transaction at all.
  quantity: z.coerce.number().int().positive().max(10_000),
});

// A real cart never holds more than a handful of distinct lines — cap it
// (same intent as cart.ts's MAX_VARIANT_IDS) so a crafted request can't
// make submitOrder fan out into an unbounded per-item findMany + a
// transaction that issues one UPDATE per line.
export const orderItemsSchema = z.array(orderItemInputSchema).min(1).max(50);

export const cancelReasonSchema = z.object({
  reason: z.string().min(1),
});

export const trackOrderSchema = z.object({
  phone: z.string().regex(/^[234]\d{7}$/, "invalidPhone"),
  reference: z.string().trim().min(1, "required"),
  productType: z.string().min(1),
});
