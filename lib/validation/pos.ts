import { z } from "zod";
import { saleItemSchema } from "@/lib/validation/sale";

const checkoutBase = {
  items: z.array(saleItemSchema).min(1).max(200),
  discount: z.number().min(0).default(0),
};

// Cash and wallet sales carry different fields, so the payment method picks
// the shape: a wallet sale must name one of the boutique's wallet accounts
// (checked server-side), a cash sale may carry the amount handed over.
export const posSaleSchema = z.discriminatedUnion("paymentMethod", [
  z.object({
    ...checkoutBase,
    paymentMethod: z.literal("cash"),
    amountReceived: z.number().min(0).nullable().default(null),
  }),
  z.object({
    ...checkoutBase,
    paymentMethod: z.literal("wallet"),
    walletAccountId: z.string().min(1),
  }),
]);

export type PosSaleInput = z.input<typeof posSaleSchema>;
