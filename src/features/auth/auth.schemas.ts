import { z } from "zod";

// Shared by the forms (checked as the admin types) and the server functions
// (checked again on arrival).
export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const mfaCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
});
