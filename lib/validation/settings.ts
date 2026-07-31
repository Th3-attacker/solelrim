import { z } from "zod";

export const settingsSchema = z.object({
  bankilyNumber: z.string().optional(),
  masrivyNumber: z.string().optional(),
  adminWhatsappNumber: z.string().min(1),
  paymentInstructions: z.string().optional(),
  siteName: z.string().optional(),
  announcementText: z.string().optional(),
  heroTitle: z.string().optional(),
  heroSubtitle: z.string().optional(),
  heroBadgeText: z.string().optional(),
  heroCtaLabel: z.string().optional(),
  heroImagePosition: z.enum(["left", "right"]).optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  instagramUrl: z.string().optional(),
  facebookUrl: z.string().optional(),
  tiktokUrl: z.string().optional(),
});

export type SettingsInput = z.infer<typeof settingsSchema>;
