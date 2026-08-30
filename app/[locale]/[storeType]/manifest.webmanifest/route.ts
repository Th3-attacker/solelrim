import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { getPublicBoutiqueSettings } from "@/lib/queries/settings";
import { resolveBoutiqueText } from "@/lib/shop/localized-boutique-text";
import { resolveStoreTheme } from "@/lib/theme/presets";

// A plain Route Handler, not the app/manifest.ts file convention — that
// convention only generates a single manifest at the app root in this
// Next.js version (see node_modules/next/dist/docs), the same reason
// app/icon-192/route.tsx and app/icon-512/route.tsx already exist as plain
// routes instead of the `icon` file convention. Linked per-boutique via
// generateMetadata's `manifest` field on (shop)/layout.tsx, so an install
// from one boutique's storefront never shows another boutique's name/icon.

// Cache per (locale, storeType) — the content only changes when a boutique
// edits its own name/theme, and both of those already broadcast a
// revalidatePath("/", "layout"). Without this the route re-runs a DB query
// (plus a Satori raster on each linked icon-*) for every install prompt /
// crawler hit, and a `?x=` query string is enough to slip past a CDN.
export const revalidate = 3600;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string; storeType: string }> },
) {
  const { locale, storeType } = await params;
  const [boutique, tShop] = await Promise.all([
    getPublicBoutiqueSettings(storeType),
    getTranslations({ locale, namespace: "shop" }),
  ]);

  const siteName = resolveBoutiqueText(boutique, locale).siteName?.trim() || tShop("siteName");
  const theme = resolveStoreTheme(boutique);
  // Always the explicit /{locale}/{storeType} path (never the branded-domain
  // "" base path): it resolves correctly on every domain type — proxy.ts
  // passes it straight through on a boutique's own domain — and keeping it
  // request-independent is what lets this route be statically cached above.
  const scopedBase = `/${locale}/${storeType}`;

  return NextResponse.json(
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
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
