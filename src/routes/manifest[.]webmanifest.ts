import { createFileRoute } from "@tanstack/react-router";

// Ex-app/manifest.ts. Platform-level manifest (one static route, no
// per-boutique variant) — "SOLAL" matches the same fallback branding already
// used by the default metadata for anything that isn't a boutique-specific
// page (admin, mainly).
export const Route = createFileRoute("/manifest.webmanifest")({
  server: {
    handlers: {
      GET: () =>
        Response.json(
          {
            name: "SOLAL",
            short_name: "SOLAL",
            description: "SOLAL — rapide et simple.",
            start_url: "/",
            display: "standalone",
            background_color: "#1E3A5F",
            theme_color: "#1E3A5F",
            icons: [
              { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
              { src: "/icon-192", sizes: "192x192", type: "image/png" },
              { src: "/icon-512", sizes: "512x512", type: "image/png" },
            ],
          },
          { headers: { "Content-Type": "application/manifest+json" } },
        ),
    },
  },
});
