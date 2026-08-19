import { z } from "zod";

export const adminUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  productType: z.string().min(1),
  canManageAppearance: z.boolean().optional().default(false),
});

export type AdminUserInput = z.infer<typeof adminUserInputSchema>;
