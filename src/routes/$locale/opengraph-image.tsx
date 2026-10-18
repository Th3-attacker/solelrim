import { createFileRoute } from "@tanstack/react-router";
import { ImageResponse } from "@vercel/og";
import { getTranslations } from "next-intl/server";
import { SOLAL_COLORS, SOLAL_LOGO_RATIO, solalLogoSvg, svgDataUri } from "@/lib/brand/solal";

// Ex-app/[locale]/opengraph-image.tsx. Default social-share card, used
// whenever a page doesn't have its own boutique logo or product photo to show
// instead (see lib/shop/metadata.ts). Lives under $locale so it can render
// the tagline in the visitor's language.

const LOGO_HEIGHT = 150;

export const Route = createFileRoute("/$locale/opengraph-image")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const t = await getTranslations({ locale: params.locale, namespace: "dashboard" });

        return new ImageResponse(
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
            <div style={{ fontSize: 32, color: "#D6E2F0" }}>{t("ogTagline")}</div>
          </div>,
          {
            width: 1200,
            height: 630,
            // Output depends only on the locale (a fixed tagline) — nothing
            // per-request: one raster per locale per day (ex-revalidate = 86400).
            headers: { "Cache-Control": "public, max-age=0, s-maxage=86400" },
          },
        );
      },
    },
  },
});
