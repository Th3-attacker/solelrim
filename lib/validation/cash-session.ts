import { z } from "zod";
import { MAX_AMOUNT } from "@/lib/validation/pos";

// Cents at most: the till columns are DECIMAL(10,2).
const money = z
  .number()
  .min(0)
  .max(MAX_AMOUNT)
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6);

export const openSessionSchema = z.object({
  openingFloat: money,
});

export const cashMovementSchema = z.object({
  type: z.enum(["IN", "OUT"]),
  amount: money.refine((value) => value > 0),
  reason: z.string().trim().min(3).max(200),
});

export const closeSessionSchema = z.object({
  sessionId: z.string().min(1),
  countedCash: money,
  // Required by the action when the count doesn't match (see
  // closeCashSession) — a shortfall or excess must be explained.
  note: z.string().trim().max(500).default(""),
});

export const dayClosureSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
