import { NextResponse } from "next/server";
import { getPublicBoutiqueSettings } from "@/lib/queries/settings";
import { getStorefrontBasePath } from "@/lib/shop/storefront-path";
import { resolveBoutiqueText } from "@/lib/shop/localized-boutique-text";
import { resolveStoreTheme } from "@/lib/theme/presets";

// A plain Route Handler, not the app/manifest.ts file convention — that
// convention only generates a single manifest at the app root in this
// Next.js version (see node_modules/next/dist/docs), the same reason
// app/icon-192/route.tsx and app/icon-512/route.tsx already exist as plain
// routes instead of the `icon` file convention. Linked per-boutique via
// generateMetadata's `manifest` field on (shop)/layout.tsx, so an install
// from one boutique's storefront never shows another boutique's name/icon.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string; storeType: string }> },
) {
  const { locale, storeType } = await params;
  const [boutique, basePath] = await Promise.all([
    getPublicBoutiqueSettings(storeType),
    getStorefrontBasePath(storeType),
  ]);

  const siteName = resolveBoutiqueText(boutique, locale).siteName?.trim() || "SOLAL";
  const theme = resolveStoreTheme(boutique);
  // basePath alone omits the locale (it's meant to be used inside an
  // already-locale-scoped <Link>) — these URLs go straight into manifest
  // JSON instead, so the locale has to be added back by hand.
  const localePrefix = `/${locale}`;

  return NextResponse.json(
    {
      name: siteName,
      short_name: siteName,
      description: `${siteName} — rapide et simple.`,
      start_url: `${localePrefix}${basePath}`,
      display: "standalone",
      background_color: theme.light.primaryForeground,
      theme_color: theme.light.primary,
      icons: [
        { src: `${localePrefix}${basePath}/icon-192`, sizes: "192x192", type: "image/png" },
        { src: `${localePrefix}${basePath}/icon-512`, sizes: "512x512", type: "image/png" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
