import { checkoutCustomerSchema } from "@/lib/validation/order";

// A Mauritanian mobile number as stored everywhere in this app: 8 local
// digits, no country code (same rule as the storefront checkout). Accepts
// what a seller actually types or pastes — spaces, dashes, a +222 prefix —
// and returns the bare local number, or null if it isn't one.
export function normalizeLocalPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("222") ? digits.slice(3) : digits;
  return checkoutCustomerSchema.shape.customerPhone.safeParse(local).success ? local : null;
}
