import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { SOLAL_COLORS, SOLAL_LOGO_RATIO, solalLogoSvg, svgDataUri } from "@/lib/brand/solal";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Output depends only on the locale (a fixed tagline) — nothing per-request.
// Pin it to a long-lived cache entry so it's a one-off Satori raster per
// locale rather than one on every share-scrape / crawler hit (every
// storefront page now points its og:image here — see lib/shop/metadata.ts).
export const revalidate = 86400;

const LOGO_HEIGHT = 150;

// Default social-share card, used whenever a page doesn't have its own
// boutique logo or product photo to show instead (see lib/shop/metadata.ts).
// Lives under [locale] (rather than app root) so it can render the tagline
// in the visitor's language.
export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard" });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 40,
          background: SOLAL_COLORS.marine,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <img
          src={svgDataUri(solalLogoSvg(SOLAL_COLORS.white))}
          width={Math.round(LOGO_HEIGHT * SOLAL_LOGO_RATIO)}
          height={LOGO_HEIGHT}
          alt="SOLAL"
        />
        <div style={{ fontSize: 32, color: "#D6E2F0" }}>
          {t("ogTagline")}
        </div>
      </div>
    ),
    { ...size },
  );
}
