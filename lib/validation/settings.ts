import { z } from "zod";
import { meetsMinimumContrast } from "@/lib/theme/custom-color";

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
// Every free-text field is capped: these are boutique-admin-writable and
// rendered straight onto the public storefront / into <meta> tags, so an
// uncapped one is a DB-bloat / oversized-payload vector (the sibling
// schemas below already all carry a .max()). The ceilings are far above any
// legitimate value — a real one never comes close.
// Deliberately loose — the goal is to stop a megabyte-scale value, not to
// enforce copy-length best practice, and to not retroactively invalidate a
// slightly-long value an existing boutique already saved.
const shortText = z.string().max(200).optional();
const lineText = z.string().max(600).optional();
const paragraphText = z.string().max(4000).optional();

export const boutiqueSettingsSchema = z.object({
  adminWhatsappNumber: z.string().min(1).max(30),
  paymentInstructions: paragraphText,
  siteName: shortText,
  siteNameAr: shortText,
  siteNameEn: shortText,
  announcementText: lineText,
  heroTitle: lineText,
  heroTitleAr: lineText,
  heroTitleEn: lineText,
  heroSubtitle: lineText,
  heroSubtitleAr: lineText,
  heroSubtitleEn: lineText,
  heroBadgeText: shortText,
  heroCtaLabel: shortText,
  heroImagePosition: z.enum(["left", "right"]).optional(),
  testimonialsEnabled: z.boolean().optional(),
  seoTitle: lineText,
  seoTitleAr: lineText,
  seoTitleEn: lineText,
  seoDescription: paragraphText,
  seoDescriptionAr: paragraphText,
  seoDescriptionEn: paragraphText,
});

export type BoutiqueSettingsInput = z.infer<typeof boutiqueSettingsSchema>;

export const socialLinkSchema = z.object({
  platform: z.string().trim().min(1).max(40),
  // Rendered as an <a href> on the public storefront footer + contact page
  // (and the admin manager) — an unrestricted string here is a stored-XSS
  // sink via a `javascript:`/`data:` URI, which the CSP's
  // `script-src 'unsafe-inline'` does NOT block. A social link is only ever
  // an external profile URL, so http(s) is the whole legitimate set.
  url: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine((value) => /^https?:\/\//i.test(value), "invalidUrl"),
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
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "invalid")
    // A hex that's a valid color can still be a "murky middle" tone where
    // neither black nor white text ever reaches WCAG AA against it — reject
    // those here rather than silently shipping unreadable button text.
    .refine(meetsMinimumContrast, "lowContrast"),
});

export type CustomThemeColorInput = z.infer<typeof customThemeColorSchema>;

export const colorModeSchema = z.enum(["auto", "light", "dark"]);

export const productTypeInputSchema = z.object({
  name: z.string().trim().min(1).max(40),
  categories: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
});

export type ProductTypeInput = z.infer<typeof productTypeInputSchema>;

// Renaming a boutique only ever touches its label — the key stays
// immutable post-creation (it's baked into existing URLs and every
// productType foreign key), so this is deliberately narrower than
// productTypeInputSchema.
export const storeTypeLabelSchema = z.object({
  label: z.string().trim().min(1).max(40),
});

export type StoreTypeLabelInput = z.infer<typeof storeTypeLabelSchema>;

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

// Superadmin-only (lib/actions/settings.ts: updateBoutiqueLicense). Only
// ACTIVE/SUSPENDED/CANCELLED are ever submitted here — GRACE_PERIOD/EXPIRED
// are derived, never written (see lib/shop/license.ts).
export const licenseTypeSchema = z.enum(["MONTHLY", "YEARLY", "PERPETUAL"]);
export const licenseStatusSchema = z.enum(["ACTIVE", "SUSPENDED", "CANCELLED"]);

export type LicenseTypeInput = z.infer<typeof licenseTypeSchema>;
export type LicenseStatusInput = z.infer<typeof licenseStatusSchema>;

// The Client's legal name/raison sociale for the license contract's section
// 34 (components/settings/license-contract-document.tsx). Empty string
// clears it back to null, same convention as storeDomainSchema.
export const licenseClientNameSchema = z.object({
  licenseClientName: z.string().trim().max(200),
});

export type LicenseClientNameInput = z.infer<typeof licenseClientNameSchema>;

// SOLAL's own (the Concédant's) contact info for the same contract's
// section 34 — superadmin-only (lib/actions/settings.ts:
// updateSolalContact). Every field is optional/blank-able: an empty string
// is stored as-is and rendered as "[à compléter]" by
// license-contract-document.tsx, same placeholder convention as the source
// document until a superadmin fills it in.
export const solalContactSchema = z.object({
  address: z.string().trim().max(300),
  phone: z.string().trim().max(60),
  email: z.string().trim().max(200).email().or(z.literal("")),
  website: z.string().trim().max(200),
});

export type SolalContactInput = z.infer<typeof solalContactSchema>;
