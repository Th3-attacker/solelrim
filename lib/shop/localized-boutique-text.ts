// Only siteName/heroTitle/heroSubtitle/seoTitle/seoDescription are worth a
// per-language override (see StoreType's schema comment). French is the
// base/fallback column; Arabic and English each have their own override,
// used when non-blank, falling back to French otherwise.
type LocalizedBoutiqueFields = {
  siteName: string | null;
  siteNameAr: string | null;
  siteNameEn: string | null;
  heroTitle: string | null;
  heroTitleAr: string | null;
  heroTitleEn: string | null;
  heroSubtitle: string | null;
  heroSubtitleAr: string | null;
  heroSubtitleEn: string | null;
  seoTitle: string | null;
  seoTitleAr: string | null;
  seoTitleEn: string | null;
  seoDescription: string | null;
  seoDescriptionAr: string | null;
  seoDescriptionEn: string | null;
};

function pick(
  base: string | null,
  ar: string | null,
  en: string | null,
  locale: string,
): string | null {
  if (locale === "ar") {
    const trimmed = ar?.trim();
    if (trimmed) return trimmed;
  }
  if (locale === "en") {
    const trimmed = en?.trim();
    if (trimmed) return trimmed;
  }
  return base;
}

export function resolveBoutiqueText<T extends LocalizedBoutiqueFields>(
  boutique: T,
  locale: string,
) {
  return {
    siteName: pick(boutique.siteName, boutique.siteNameAr, boutique.siteNameEn, locale),
    heroTitle: pick(boutique.heroTitle, boutique.heroTitleAr, boutique.heroTitleEn, locale),
    heroSubtitle: pick(
      boutique.heroSubtitle,
      boutique.heroSubtitleAr,
      boutique.heroSubtitleEn,
      locale,
    ),
    seoTitle: pick(boutique.seoTitle, boutique.seoTitleAr, boutique.seoTitleEn, locale),
    seoDescription: pick(
      boutique.seoDescription,
      boutique.seoDescriptionAr,
      boutique.seoDescriptionEn,
      locale,
    ),
  };
}
