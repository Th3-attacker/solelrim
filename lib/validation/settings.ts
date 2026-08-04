import { z } from "zod";

// Everything a boutique's own admin can edit about their boutique — payment
// contact info, and (since each boutique has its own public storefront
// route) its storefront's own name, announcement bar, hero, and SEO too.
export const boutiqueSettingsSchema = z.object({
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
});

export type BoutiqueSettingsInput = z.infer<typeof boutiqueSettingsSchema>;

export const socialLinkSchema = z.object({
  platform: z.string().trim().min(1).max(40),
  url: z.string().trim().min(1).max(500),
});

export type SocialLinkInput = z.infer<typeof socialLinkSchema>;

export const walletAccountSchema = z.object({
  provider: z.string().trim().min(1).max(40),
  number: z.string().trim().min(1).max(30),
});

export type WalletAccountInput = z.infer<typeof walletAccountSchema>;

export const productTypeInputSchema = z.object({
  name: z.string().trim().min(1).max(40),
  categories: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
});

export type ProductTypeInput = z.infer<typeof productTypeInputSchema>;

// A bare hostname, no protocol/path — e.g. "solel.com", not
// "https://solel.com/". Superadmin-only (lib/actions/settings.ts).
const HOSTNAME_RE =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

// Empty string clears the domain; a non-empty value is normalized (protocol/
// path/trailing slash stripped, lowercased) then checked against a basic
// hostname shape. The "must differ from this app's own canonical host"
// check lives in updateStoreDomain instead — it needs an env lookup, not a
// pure validation rule.
export const storeDomainSchema = z.object({
  domain: z
    .string()
    .trim()
    .transform((value) =>
      value
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "")
        .toLowerCase(),
    )
    .refine((value) => value === "" || HOSTNAME_RE.test(value), "invalid"),
});

export type StoreDomainInput = z.infer<typeof storeDomainSchema>;
