import { createFileRoute } from "@tanstack/react-router";
import { apiHandlers } from "@/src/api/adapter";
import { GET } from "@/src/api/v1/boutiques/[key]/products/[slug]/route";

// GET /api/v1/boutiques/{key}/products/{slug} — voir src/api/v1/boutiques/[key]/products/[slug]/route.ts.
export const Route = createFileRoute("/api/v1/boutiques/$key/products/$slug/")({
  server: { handlers: apiHandlers({ GET }) },
});
