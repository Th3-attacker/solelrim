import { z } from "zod";

// Storefront layout variants — superadmin-only (lib/actions/settings.ts:
// setHeroVariant/setCardVariant), kept out of boutiqueSettingsSchema below
// so a BOUTIQUE_ADMIN posting to updateBoutiqueSettings can't smuggle a
// change to either in, even with the picker UI hidden from them.
export const heroVariantSchema = z.enum(["split", "fullbleed", "minimal"]);
export const cardVariantSchema = z.enum(["default", "bordered", "cart"]);
export const footerVariantSchema = z.enum(["columns", "minimal", "centered"]);

// Everything a boutique's own admin can edit about their boutique — payment
// contact info, and (since each boutique has its own public storefront
// route) its storefront's own name, announcement bar, hero, and SEO too.
export const boutiqueSettingsSchema = z.object({
  adminWhatsappNumber: z.string().min(1),
  paymentInstructions: z.string().optional(),
  siteName: z.string().optional(),
  siteNameAr: z.string().optional(),
  siteNameEn: z.string().optional(),
  announcementText: z.string().optional(),
  heroTitle: z.string().optional(),
  heroTitleAr: z.string().optional(),
  heroTitleEn: z.string().optional(),
  heroSubtitle: z.string().optional(),
  heroSubtitleAr: z.string().optional(),
  heroSubtitleEn: z.string().optional(),
  heroBadgeText: z.string().optional(),
  heroCtaLabel: z.string().optional(),
  heroImagePosition: z.enum(["left", "right"]).optional(),
  testimonialsEnabled: z.boolean().optional(),
  seoTitle: z.string().optional(),
  seoTitleAr: z.string().optional(),
  seoTitleEn: z.string().optional(),
  seoDescription: z.string().optional(),
  seoDescriptionAr: z.string().optional(),
  seoDescriptionEn: z.string().optional(),
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

export const testimonialSchema = z.object({
  customerName: z.string().trim().min(1).max(80),
  quote: z.string().trim().min(1).max(500),
  rating: z.number().int().min(1).max(5).optional(),
  // Re-validated server-side (scope + DELIVERED status) in createTestimonial
  // — this only shapes the input, it isn't the trust boundary.
  orderId: z.string().trim().min(1).optional(),
});

export type TestimonialInput = z.infer<typeof testimonialSchema>;

export const customThemeColorSchema = z.object({
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "invalid"),
});

export type CustomThemeColorInput = z.infer<typeof customThemeColorSchema>;

export const colorModeSchema = z.enum(["auto", "light", "dark"]);

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
