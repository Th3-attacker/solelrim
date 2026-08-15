import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
          gap: 24,
          background: "#18181b",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 120,
            fontWeight: 700,
            letterSpacing: 4,
            color: "#ffffff",
          }}
        >
          SOLAL
        </div>
        <div style={{ fontSize: 32, color: "#a1a1aa" }}>
          {t("ogTagline")}
        </div>
      </div>
    ),
    { ...size },
  );
}
