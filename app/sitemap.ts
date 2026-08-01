import type { MetadataRoute } from "next";
import { getActiveProducts } from "@/lib/queries/shop";
import { getStoreTypes } from "@/lib/queries/settings";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/shop/site-url";

// Only real, canonical, crawlable pages — /{storeType}/products redirects
// straight to /{storeType} (see the (shop)/products/page.tsx redirect) so
// it's not listed here, and admin is excluded entirely (see robots.ts).
const STATIC_SUBPATHS = ["", "/about", "/contact"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl();
  const storeTypes = await getStoreTypes();

  const urlFor = (locale: string, path: string) => `${baseUrl}/${locale}${path}`;
  const alternatesFor = (path: string) =>
    Object.fromEntries(routing.locales.map((locale) => [locale, urlFor(locale, path)]));

  const entries: MetadataRoute.Sitemap = [];

  for (const storeType of storeTypes) {
    const staticPaths = STATIC_SUBPATHS.map((subpath) => `/${storeType.key}${subpath}`);
    for (const path of staticPaths) {
      for (const locale of routing.locales) {
        entries.push({
          url: urlFor(locale, path),
          lastModified: new Date(),
          alternates: { languages: alternatesFor(path) },
        });
      }
    }

    // isActive: false products are excluded by getActiveProducts itself.
    const products = await getActiveProducts(storeType.key);
    for (const product of products) {
      const path = `/${storeType.key}/products/${product.slug}`;
      for (const locale of routing.locales) {
        entries.push({
          url: urlFor(locale, path),
          lastModified: product.updatedAt,
          alternates: { languages: alternatesFor(path) },
        });
      }
    }
  }

  return entries;
}
