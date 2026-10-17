import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/shop/site-url";
import { routing } from "@/i18n/routing";

// Mirrors sitemap.ts's own domain-vs-shared-platform logic exactly — a
// boutique with a bound custom domain is canonically reachable there with
// no /{storeKey} segment (see proxy.ts), so canonical/hreflang tags must
// agree with what the sitemap already tells Google, not the path the
// current request happened to arrive on.
// Open Graph attend un identifiant langue_PAYS (ex. "fr_FR"), pas une simple
// langue ("fr") : un og:locale bare n'est pas reconnu par Facebook/WhatsApp,
// qui retomberaient sur une locale par défaut pour l'aperçu du lien.
// Chaque locale de l'app est mappée sur la variante correspondant au pays
// cible (Mauritanie pour l'arabe, standard international pour le français et
// l'anglais) — toute locale ajoutée plus tard sans mapping retombe sur la
// langue seule, comportement explicite et non un crash.
const OG_LOCALES: Record<string, string> = {
  fr: "fr_FR",
  en: "en_US",
  ar: "ar_MR",
};

export function ogLocale(locale: string): string {
  return OG_LOCALES[locale] ?? locale;
}

export function buildStoreUrl({
  domain,
  storeKey,
  path,
  locale,
}: {
  domain?: string | null;
  storeKey: string;
  path: string;
  locale: string;
}): string {
  const base = domain ? `https://${domain}` : getSiteUrl();
  const prefix = domain ? "" : `/${storeKey}`;
  return `${base}/${locale}${prefix}${path}`;
}

// Shared Open Graph + Twitter card shape for every public storefront page —
// keeps social/WhatsApp link previews consistent without repeating the same
// object literal at every generateMetadata() call site. Also re-asserts
// metadataBase here (already set on the root [locale]/layout.tsx) — Next
// warns and falls back to localhost when resolving the file-convention
// opengraph-image.tsx's relative URL if it doesn't find metadataBase on the
// exact metadata object being resolved for a given route.
//
// domain/storeKey/path together produce the canonical + hreflang alternate
// tags for the page — every public page passes them so Google consolidates
// the fr/en/ar versions as translations of one page instead of treating
// them as near-duplicate content competing against each other.
export function buildSocialMetadata({
  title,
  description,
  imageUrl,
  locale,
  domain,
  storeKey,
  path,
  siteName,
}: {
  title: string;
  description: string;
  imageUrl?: string | null;
  locale: string;
  domain?: string | null;
  storeKey: string;
  path: string;
  siteName?: string | null;
}): Pick<Metadata, "metadataBase" | "openGraph" | "twitter" | "alternates"> {
  // Returning an explicit openGraph/twitter object from a nested
  // generateMetadata replaces the parent's resolved value wholesale — Next
  // does NOT then merge back the file-convention opengraph-image it would
  // have injected on its own. So when there's no boutique logo / product
  // photo, point at that same default card (app/[locale]/opengraph-image.tsx)
  // explicitly. Absolute URL so it resolves identically whether the page is
  // served from the shared platform host or a boutique's own bound domain
  // (proxy.ts leaves /{locale}/opengraph-image un-rewritten on both).
  const base = domain ? `https://${domain}` : getSiteUrl();
  const images = [{ url: imageUrl ?? `${base}/${locale}/opengraph-image` }];

  const urlFor = (l: string) => buildStoreUrl({ domain, storeKey, path, locale: l });
  const languages = Object.fromEntries(routing.locales.map((l) => [l, urlFor(l)]));

  return {
    metadataBase: new URL(base),
    alternates: {
      canonical: urlFor(locale),
      languages: { ...languages, "x-default": urlFor(routing.defaultLocale) },
    },
    openGraph: {
      title,
      description,
      url: urlFor(locale),
      locale: ogLocale(locale),
      type: "website",
      images,
      ...(siteName ? { siteName } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images,
    },
  };
}

// JSON-LD structured data (Organization/Product/BreadcrumbList) is plain
// data, not markup — the values going into it are still admin-authored
// free text (boutique name, product description), so this stays
// dangerouslySetInnerHTML like components/ui/chart.tsx's inline styles.
// Escaping "<" is the standard guard for that case (Next.js's own JSON-LD
// docs recommend it): it blocks a "</script>" sequence inside the data
// from prematurely closing the tag and getting interpreted as markup.
export function jsonLdScriptProps(data: unknown): { __html: string } {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}
