// Why an order was refused or cancelled: the presets offered to the admin,
// and the "orders" message key each one reads as. Kept apart from the
// message bundles (lib/shop/client-messages.ts), so a screen can import them
// without the three catalogues.
export const REJECT_REASON_PRESETS = [
  "invalid_payment",
  "out_of_stock",
  "undeliverable_location",
] as const;

// A free-typed ("other") reason has no entry here and is shown and sent as
// whatever text the admin wrote.
export const REASON_LABEL_KEY: Record<
  string,
  | "reasonInvalidPayment"
  | "reasonOutOfStock"
  | "reasonUndeliverableLocation"
  | "reasonPaymentTimeout"
> = {
  invalid_payment: "reasonInvalidPayment",
  out_of_stock: "reasonOutOfStock",
  undeliverable_location: "reasonUndeliverableLocation",
  // Set by the timer, not an admin (lib/services/pending-expiry.ts).
  payment_timeout: "reasonPaymentTimeout",
};
