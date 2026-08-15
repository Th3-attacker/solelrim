import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/shop/site-url";
import { routing } from "@/i18n/routing";

// Mirrors sitemap.ts's own domain-vs-shared-platform logic exactly — a
// boutique with a bound custom domain is canonically reachable there with
// no /{storeKey} segment (see proxy.ts), so canonical/hreflang tags must
// agree with what the sitemap already tells Google, not the path the
// current request happened to arrive on.
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
}: {
  title: string;
  description: string;
  imageUrl?: string | null;
  locale: string;
  domain?: string | null;
  storeKey: string;
  path: string;
}): Pick<Metadata, "metadataBase" | "openGraph" | "twitter" | "alternates"> {
  // Omitted entirely (not even as an explicit `undefined` key) when there's
  // no boutique/product photo to use, so Next falls through to the nearest
  // file-convention opengraph-image.tsx instead of rendering no image.
  const images = imageUrl ? [{ url: imageUrl }] : undefined;

  const urlFor = (l: string) => buildStoreUrl({ domain, storeKey, path, locale: l });
  const languages = Object.fromEntries(routing.locales.map((l) => [l, urlFor(l)]));

  return {
    metadataBase: new URL(getSiteUrl()),
    alternates: {
      canonical: urlFor(locale),
      languages: { ...languages, "x-default": urlFor(routing.defaultLocale) },
    },
    openGraph: {
      title,
      description,
      locale,
      type: "website",
      ...(images ? { images } : {}),
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title,
      description,
      ...(images ? { images } : {}),
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
