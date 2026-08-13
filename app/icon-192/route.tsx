import { ImageResponse } from "next/og";

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
          background: "#18181b",
          borderRadius: 42,
          color: "#ffffff",
          fontSize: 120,
          fontWeight: 700,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        S
      </div>
    ),
    { ...size },
  );
}
