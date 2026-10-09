import { ImageResponse } from "next/og";
import { SOLAL_COLORS, solalSymbolSvg, svgDataUri } from "@/lib/brand/solal";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

// Larger sibling of app/icon.tsx (32x32, used for the browser favicon) —
// served as a plain route instead of Next's `icon` file convention since
// that convention is for favicon <link> tags, not manifest.ts icon entries.
export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: SOLAL_COLORS.marine,
          borderRadius: 42,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={svgDataUri(solalSymbolSvg(SOLAL_COLORS.white))}
          width={128}
          height={128}
          alt=""
        />
      </div>
    ),
    { ...size },
  );
}
