import type { MetadataRoute } from "next";

// Platform-level manifest (one static route, no per-boutique variant) —
// "SOLAL" matches the same fallback branding already used by the root
// layout's generateMetadata for anything that isn't a boutique-specific
// page (admin, mainly).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SOLAL",
    short_name: "SOLAL",
    description: "SOLAL — rapide et simple.",
    start_url: "/",
    display: "standalone",
    background_color: "#18181b",
    theme_color: "#18181b",
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { src: "/icon-192", sizes: "192x192", type: "image/png" },
      { src: "/icon-512", sizes: "512x512", type: "image/png" },
    ],
  };
}
