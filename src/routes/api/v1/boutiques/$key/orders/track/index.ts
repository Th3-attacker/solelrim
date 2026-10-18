import { createFileRoute } from "@tanstack/react-router";
import { apiHandlers } from "@/src/api/adapter";
import { POST } from "@/src/api/v1/boutiques/[key]/orders/track/route";

// POST /api/v1/boutiques/{key}/orders/track — voir src/api/v1/boutiques/[key]/orders/track/route.ts.
export const Route = createFileRoute("/api/v1/boutiques/$key/orders/track/")({
  server: { handlers: apiHandlers({ POST }) },
});
