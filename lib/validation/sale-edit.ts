import { z } from "zod";

// Only these fields of a recorded sale may ever change. Anything else sent
// along (items, total, discount…) is stripped by zod and never reaches the
// database — an amount error goes through a refund instead.
export const saleEditSchema = z
  .object({
    saleId: z.string().min(1),
    // null = keep the recorded payment as is (it may be one the edit form
    // can't offer, like a legacy "card" or a since-deleted wallet).
    paymentMethod: z.enum(["cash", "wallet"]).nullable().default(null),
    // Required for a wallet payment; which of the boutique's wallets.
    walletAccountId: z.string().min(1).nullable().default(null),
    clientId: z.string().min(1).nullable(),
    notes: z.string().trim().max(1000).default(""),
    reason: z.string().trim().min(3).max(500),
  })
  .refine((data) => data.paymentMethod !== "wallet" || data.walletAccountId !== null);

export type SaleEditInput = z.input<typeof saleEditSchema>;
