import { createFileRoute } from "@tanstack/react-router";
import { routing } from "@/i18n/routing";
import { getStoreTypes } from "@/lib/queries/settings";
import { getActiveProducts } from "@/lib/queries/shop";
import { getSiteUrl } from "@/lib/shop/site-url";

// Ex-app/sitemap.ts. Only real, canonical, crawlable pages — the catalog is
// listed at its bare /{storeType}/products URL (no filter query params,
// those aren't distinct canonical pages), and admin is excluded entirely
// (see robots[.]txt.ts).
const STATIC_SUBPATHS = ["", "/about", "/contact", "/products", "/legal"];

type Entry = { url: string; lastModified: Date; languages: Record<string, string> };

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

async function sitemapEntries(): Promise<Entry[]> {
  const baseUrl = getSiteUrl();
  const storeTypes = await getStoreTypes();
  const entries: Entry[] = [];

  for (const storeType of storeTypes) {
    // A boutique with its own domain is reachable there with no /{key}
    // segment (see lib/services/branded-domain.ts) — its canonical URLs
    // reflect that instead of the shared multi-boutique domain.
    const base = storeType.domain ? `https://${storeType.domain}` : baseUrl;
    const prefix = storeType.domain ? "" : `/${storeType.key}`;
    const urlFor = (locale: string, path: string) => `${base}/${locale}${path}`;
    const alternatesFor = (path: string) =>
      Object.fromEntries(routing.locales.map((locale) => [locale, urlFor(locale, path)]));

    for (const path of STATIC_SUBPATHS.map((subpath) => `${prefix}${subpath}`)) {
      for (const locale of routing.locales) {
        entries.push({
          url: urlFor(locale, path),
          lastModified: new Date(),
          languages: alternatesFor(path),
        });
      }
    }

    // isActive: false products are excluded by getActiveProducts itself.
    const products = await getActiveProducts(storeType.key);
    for (const product of products) {
      const path = `${prefix}/products/${product.slug}`;
      for (const locale of routing.locales) {
        entries.push({
          url: urlFor(locale, path),
          lastModified: product.updatedAt,
          languages: alternatesFor(path),
        });
      }
    }
  }

  return entries;
}

// Le même XML que générait Next.js pour MetadataRoute.Sitemap (hreflang compris).
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const urls = (await sitemapEntries()).map((entry) =>
          [
            "<url>",
            `<loc>${escapeXml(entry.url)}</loc>`,
            ...Object.entries(entry.languages).map(
              ([lang, href]) =>
                `<xhtml:link rel="alternate" hreflang="${lang}" href="${escapeXml(href)}" />`,
            ),
            `<lastmod>${entry.lastModified.toISOString()}</lastmod>`,
            "</url>",
          ].join("\n"),
        );
        const xml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
          ...urls,
          "</urlset>",
          "",
        ].join("\n");
        return new Response(xml, { headers: { "Content-Type": "application/xml" } });
      },
    },
  },
});
