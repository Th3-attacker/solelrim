import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/shop/site-url";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // localePrefix "always" means the real admin paths are /fr/admin,
      // /en/admin, /ar/admin — a bare "/admin" rule wouldn't match any of
      // them, since Disallow matches on path prefix.
      disallow: routing.locales.map((locale) => `/${locale}/admin`),
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
