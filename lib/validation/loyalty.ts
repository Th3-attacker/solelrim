import { z } from "zod";

export const loyaltyEnrollSchema = z.object({
  phone: z.string().max(40),
  // Optional: a customer can join with just their number.
  name: z.string().trim().max(120).default(""),
});

// Whole MRU and whole points — the checkout never deals in fractions of
// either. Upper bounds only stop absurd values; a real rule never nears them.
export const loyaltySettingsSchema = z.object({
  enabled: z.boolean(),
  spendPerPoint: z.number().int().min(1).max(1_000_000),
  rewardPoints: z.number().int().min(1).max(1_000_000),
  rewardValue: z.number().int().min(1).max(10_000_000),
});
