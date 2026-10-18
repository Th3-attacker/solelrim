import { createFileRoute } from "@tanstack/react-router";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/shop/site-url";

// Ex-app/robots.ts.
export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () => {
        // localePrefix "always" means the real admin paths are /fr/admin,
        // /en/admin, /ar/admin — a bare "/admin" rule wouldn't match any of
        // them, since Disallow matches on path prefix.
        // /api/ : l'API v1 ne sert que l'application mobile (JSON, pas de HTML
        // à indexer) — la bloquer économise le budget de crawl sans rien
        // casser : les robots.txt ne régissent pas les requêtes d'une app
        // native, et le rendu des pages publiques ne dépend d'aucune route API.
        const disallow = ["/api/", ...routing.locales.map((locale) => `/${locale}/admin`)];
        const body = [
          "User-Agent: *",
          "Allow: /",
          ...disallow.map((path) => `Disallow: ${path}`),
          "",
          `Sitemap: ${getSiteUrl()}/sitemap.xml`,
          "",
        ].join("\n");
        return new Response(body, { headers: { "Content-Type": "text/plain" } });
      },
    },
  },
});
