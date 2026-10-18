import { createFileRoute } from "@tanstack/react-router";
import { getTranslations } from "next-intl/server";
import { getPublicBoutiqueSettings } from "@/lib/queries/settings";
import { resolveBoutiqueText } from "@/lib/shop/localized-boutique-text";
import { resolveStoreTheme } from "@/lib/theme/presets";
import { PUBLIC_ASSET_CACHE } from "@/src/server/icons";

// Ex-app/[locale]/[storeType]/manifest.webmanifest/route.ts. Linked
// per-boutique via the shop layout's `manifest` metadata, so an install from
// one boutique's storefront never shows another boutique's name/icon.
export const Route = createFileRoute("/$locale/$storeType/manifest.webmanifest")({
  server: {
    handlers: {
      GET: async ({ params: { locale, storeType } }) => {
        const [boutique, tShop] = await Promise.all([
          getPublicBoutiqueSettings(storeType),
          getTranslations({ locale, namespace: "shop" }),
        ]);

        const siteName =
          resolveBoutiqueText(boutique, locale).siteName?.trim() || tShop("siteName");
        const theme = resolveStoreTheme(boutique);
        // Always the explicit /{locale}/{storeType} path (never the
        // branded-domain "" base path): it resolves correctly on every domain
        // type — the router maps it straight through on a boutique's own
        // domain — and keeping it request-independent is what lets the CDN
        // cache it.
        const scopedBase = `/${locale}/${storeType}`;

        return Response.json(
          {
            name: siteName,
            short_name: siteName,
            description: `${siteName} — rapide et simple.`,
            start_url: scopedBase,
            display: "standalone",
            background_color: theme.light.primaryForeground,
            theme_color: theme.light.primary,
            icons: [
              { src: `${scopedBase}/icon-192`, sizes: "192x192", type: "image/png" },
              { src: `${scopedBase}/icon-512`, sizes: "512x512", type: "image/png" },
            ],
          },
          {
            headers: {
              "Content-Type": "application/manifest+json",
              "Cache-Control": PUBLIC_ASSET_CACHE,
            },
          },
        );
      },
    },
  },
});
