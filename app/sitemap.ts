import type { MetadataRoute } from "next";
import { getActiveProducts } from "@/lib/queries/shop";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/shop/site-url";

// Only real, canonical, crawlable pages — /products redirects straight to
// / (see app/[locale]/(shop)/products/page.tsx) so it's not listed here,
// and admin is excluded entirely (see robots.ts).
const STATIC_PATHS = ["", "/about", "/contact"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl();
  const products = await getActiveProducts();

  const urlFor = (locale: string, path: string) => `${baseUrl}/${locale}${path}`;
  const alternatesFor = (path: string) =>
    Object.fromEntries(routing.locales.map((locale) => [locale, urlFor(locale, path)]));

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.flatMap((path) =>
    routing.locales.map((locale) => ({
      url: urlFor(locale, path),
      lastModified: new Date(),
      alternates: { languages: alternatesFor(path) },
    })),
  );

  // isActive: false products are excluded by getActiveProducts itself.
  const productEntries: MetadataRoute.Sitemap = products.flatMap((product) => {
    const path = `/products/${product.slug}`;
    return routing.locales.map((locale) => ({
      url: urlFor(locale, path),
      lastModified: product.updatedAt,
      alternates: { languages: alternatesFor(path) },
    }));
  });

  return [...staticEntries, ...productEntries];
}
