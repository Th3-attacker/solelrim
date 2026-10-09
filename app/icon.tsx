import { ImageResponse } from "next/og";
import { SOLAL_COLORS, solalSymbolSvg, svgDataUri } from "@/lib/brand/solal";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 7,
        }}
      >
        <img src={svgDataUri(solalSymbolSvg(SOLAL_COLORS.white))} width={26} height={26} alt="" />
      </div>
    ),
    { ...size },
  );
}
