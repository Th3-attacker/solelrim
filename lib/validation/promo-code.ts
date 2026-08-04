import { z } from "zod";

export const promoCodeSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3)
      .max(30)
      .regex(/^[A-Za-z0-9_-]+$/, "invalidCode")
      .transform((value) => value.toUpperCase()),
    discountType: z.enum(["PERCENT", "FIXED"]),
    discountValue: z.coerce.number().positive(),
    clientId: z.string().nullable().default(null),
    expiresAt: z.string().nullable().default(null),
    maxUses: z.coerce.number().int().positive().nullable().default(null),
  })
  .refine((data) => data.discountType !== "PERCENT" || data.discountValue <= 100, {
    message: "invalidPercent",
    path: ["discountValue"],
  });

export type PromoCodeInput = z.infer<typeof promoCodeSchema>;

export const applyPromoCodeSchema = z.object({
  code: z.string().trim().min(1),
  productType: z.string().min(1),
  customerPhone: z.string().regex(/^[234]\d{7}$/),
  subtotal: z.coerce.number().nonnegative(),
});
