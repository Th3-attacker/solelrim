import "server-only";
import { ImageResponse } from "@vercel/og";
import { getTranslations } from "next-intl/server";
import { SOLAL_COLORS, solalSymbolSvg, svgDataUri } from "@/lib/brand/solal";
import { getPublicBoutiqueSettings } from "@/lib/queries/settings";
import { resolveBoutiqueText } from "@/lib/shop/localized-boutique-text";
import { getStoreLogoUrl } from "@/lib/supabase/storage";
import { resolveStoreTheme } from "@/lib/theme/presets";

// Les icônes générées (ex-app/icon.tsx, app/icon-*/route.tsx et
// app/[locale]/[storeType]/icon-*/route.tsx), une fonction par famille au
// lieu d'un fichier par taille.

// Ex-`export const revalidate = 3600` : mises en cache une heure par le CDN
// au lieu d'être re-rastérisées (Satori) — plus une lecture en base et le
// logo de la boutique — à chaque requête. Non authentifiées et sinon sans
// cache, une boucle `?x=<n>` serait un moyen peu coûteux de brûler du calcul.
export const PUBLIC_ASSET_CACHE = "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400";

// Les proportions d'origine, en fraction de la taille de l'icône.
const RADIUS: Record<number, number> = { 32: 7, 192: 42, 512: 112 };
const SYMBOL: Record<number, number> = { 32: 26, 192: 128, 512: 341 };

// L'icône de la plateforme SOLAL (favicon, manifeste racine, pages hors
// boutique comme l'admin).
export function solalIcon(size: 32 | 192 | 512): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: SOLAL_COLORS.marine,
        borderRadius: RADIUS[size],
      }}
    >
      <img
        src={svgDataUri(solalSymbolSvg(SOLAL_COLORS.white))}
        width={SYMBOL[size]}
        height={SYMBOL[size]}
        alt=""
      />
    </div>,
    { width: size, height: size, headers: { "Cache-Control": PUBLIC_ASSET_CACHE } },
  );
}

// Per-boutique icon — installing one boutique's storefront to a home screen
// should never show another boutique's name or icon.
export async function boutiqueIcon(
  locale: string,
  storeType: string,
  size: 192 | 512,
): Promise<ImageResponse> {
  const [boutique, tShop] = await Promise.all([
    getPublicBoutiqueSettings(storeType),
    getTranslations({ locale, namespace: "shop" }),
  ]);
  const siteName = resolveBoutiqueText(boutique, locale).siteName?.trim() || tShop("siteName");
  const theme = resolveStoreTheme(boutique);
  const options = { width: size, height: size, headers: { "Cache-Control": PUBLIC_ASSET_CACHE } };
  const large = size === 512;

  if (boutique.logoStoragePath) {
    return new ImageResponse(
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          borderRadius: RADIUS[size],
        }}
      >
        <img
          src={getStoreLogoUrl(boutique.logoStoragePath)}
          width={large ? 384 : 144}
          height={large ? 384 : 144}
          style={{ objectFit: "contain" }}
          alt=""
        />
      </div>,
      options,
    );
  }

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: theme.light.primary,
        borderRadius: RADIUS[size],
        color: theme.light.primaryForeground,
        fontSize: large ? 320 : 120,
        fontWeight: 700,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {siteName.charAt(0).toUpperCase()}
    </div>,
    options,
  );
}
