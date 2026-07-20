import { z } from "zod";

export const clientSchema = z.object({
  fullName: z.string().min(1),
  phone: z
    .string()
    .regex(/^\d{6,15}$/, "invalidPhone")
    .optional()
    .or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export type ClientInput = z.infer<typeof clientSchema>;
