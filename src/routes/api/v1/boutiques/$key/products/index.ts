import { createFileRoute } from "@tanstack/react-router";
import { apiHandlers } from "@/src/api/adapter";
import { GET } from "@/src/api/v1/boutiques/[key]/products/route";

// GET /api/v1/boutiques/{key}/products — voir src/api/v1/boutiques/[key]/products/route.ts.
export const Route = createFileRoute("/api/v1/boutiques/$key/products/")({
  server: { handlers: apiHandlers({ GET }) },
});
