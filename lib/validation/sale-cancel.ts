import { z } from "zod";

// Cancelling voids a whole sale, so it always carries a reason, kept in the
// audit entry like a refund's or an edit's.
export const saleCancelSchema = z.object({
  saleId: z.string().min(1),
  reason: z.string().trim().min(3).max(500),
});

