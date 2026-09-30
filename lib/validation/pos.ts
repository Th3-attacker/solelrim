import { z } from "zod";
import { saleItemSchema } from "@/lib/validation/sale";

// Largest value the Sale money columns hold (DECIMAL(10,2)) — anything
// above would overflow inside the transaction instead of being refused
// cleanly as invalid input.
const MAX_AMOUNT = 99_999_999.99;
const amount = z.number().min(0).max(MAX_AMOUNT);

const checkoutBase = {
  items: z.array(saleItemSchema).min(1).max(200),
  discount: amount.default(0),
  // The total the seller saw and collected — the server refuses the sale if
  // its own recomputed total differs (a price changed since the screen
  // loaded), rather than silently recording a different amount.
  expectedTotal: amount,
  // Optional loyalty card: which enrolled client, and whether to spend one
  // reward. Points and the reward value are always computed server-side.
  loyalty: z
    .object({ clientId: z.string().min(1), redeem: z.boolean() })
    .nullable()
    .default(null),
};

// Cash and wallet sales carry different fields, so the payment method picks
// the shape: a wallet sale must name one of the boutique's wallet accounts
// (checked server-side), a cash sale may carry the amount handed over.
export const posSaleSchema = z.discriminatedUnion("paymentMethod", [
  z.object({
    ...checkoutBase,
    paymentMethod: z.literal("cash"),
    amountReceived: amount.nullable().default(null),
  }),
  z.object({
    ...checkoutBase,
    paymentMethod: z.literal("wallet"),
    walletAccountId: z.string().min(1),
  }),
]);

export type PosSaleInput = z.input<typeof posSaleSchema>;
