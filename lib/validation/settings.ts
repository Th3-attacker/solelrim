import { z } from "zod";

export const settingsSchema = z.object({
  bankilyNumber: z.string().optional(),
  masrivyNumber: z.string().optional(),
  adminWhatsappNumber: z.string().min(1),
  paymentInstructions: z.string().optional(),
});

export type SettingsInput = z.infer<typeof settingsSchema>;
