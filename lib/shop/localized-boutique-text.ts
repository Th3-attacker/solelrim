// Only siteName/heroTitle/heroSubtitle/seoTitle/seoDescription are worth a
// per-language override (see StoreType's schema comment) — and only for
// Arabic: English reuses the French/base column by explicit product
// decision, so there's no separate "en" slot to resolve here.
type LocalizedBoutiqueFields = {
  siteName: string | null;
  siteNameAr: string | null;
  heroTitle: string | null;
  heroTitleAr: string | null;
  heroSubtitle: string | null;
  heroSubtitleAr: string | null;
  seoTitle: string | null;
  seoTitleAr: string | null;
  seoDescription: string | null;
  seoDescriptionAr: string | null;
};

function pick(base: string | null, ar: string | null, locale: string): string | null {
  if (locale === "ar") {
    const trimmed = ar?.trim();
    if (trimmed) return trimmed;
  }
  return base;
}

export function resolveBoutiqueText<T extends LocalizedBoutiqueFields>(
  boutique: T,
  locale: string,
) {
  return {
    siteName: pick(boutique.siteName, boutique.siteNameAr, locale),
    heroTitle: pick(boutique.heroTitle, boutique.heroTitleAr, locale),
    heroSubtitle: pick(boutique.heroSubtitle, boutique.heroSubtitleAr, locale),
    seoTitle: pick(boutique.seoTitle, boutique.seoTitleAr, locale),
    seoDescription: pick(boutique.seoDescription, boutique.seoDescriptionAr, locale),
  };
}
