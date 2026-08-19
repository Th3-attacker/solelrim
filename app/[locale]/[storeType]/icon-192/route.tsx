import { ImageResponse } from "next/og";
import { getPublicBoutiqueSettings } from "@/lib/queries/settings";
import { resolveBoutiqueText } from "@/lib/shop/localized-boutique-text";
import { resolveStoreTheme } from "@/lib/theme/presets";
import { getStoreLogoUrl } from "@/lib/supabase/storage";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

// Per-boutique sibling of app/icon-192/route.tsx (which stays as the
// generic "SOLAL" fallback for admin/non-boutique pages) — installing one
// boutique's storefront to a home screen should never show another
// boutique's name or icon. Plain route, not the `icon` file convention,
// same reason as the root one (see manifest.webmanifest/route.ts).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string; storeType: string }> },
) {
  const { locale, storeType } = await params;
  const boutique = await getPublicBoutiqueSettings(storeType);
  const siteName = resolveBoutiqueText(boutique, locale).siteName?.trim() || "SOLAL";
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
            borderRadius: 42,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getStoreLogoUrl(boutique.logoStoragePath)}
            width={144}
            height={144}
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
          borderRadius: 42,
          color: theme.light.primaryForeground,
          fontSize: 120,
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
