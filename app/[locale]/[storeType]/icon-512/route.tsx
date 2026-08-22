import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { getPublicBoutiqueSettings } from "@/lib/queries/settings";
import { resolveBoutiqueText } from "@/lib/shop/localized-boutique-text";
import { resolveStoreTheme } from "@/lib/theme/presets";
import { getStoreLogoUrl } from "@/lib/supabase/storage";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// Per-boutique sibling of app/icon-512/route.tsx — see icon-192/route.tsx
// in this same directory for the full rationale.
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

  if (boutique.logoStoragePath) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#ffffff",
            borderRadius: 112,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getStoreLogoUrl(boutique.logoStoragePath)}
            width={384}
            height={384}
            style={{ objectFit: "contain" }}
            alt=""
          />
        </div>
      ),
      { ...size },
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: theme.light.primary,
          borderRadius: 112,
          color: theme.light.primaryForeground,
          fontSize: 320,
          fontWeight: 700,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {siteName.charAt(0).toUpperCase()}
      </div>
    ),
    { ...size },
  );
}
