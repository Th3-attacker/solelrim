import { createFileRoute } from "@tanstack/react-router";
import { apiHandlers } from "@/src/api/adapter";
import { POST } from "@/src/api/v1/boutiques/[key]/promo/route";

// POST /api/v1/boutiques/{key}/promo — voir src/api/v1/boutiques/[key]/promo/route.ts.
export const Route = createFileRoute("/api/v1/boutiques/$key/promo/")({
  server: { handlers: apiHandlers({ POST }) },
});
