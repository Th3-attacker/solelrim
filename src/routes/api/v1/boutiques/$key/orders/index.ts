import { createFileRoute } from "@tanstack/react-router";
import { apiHandlers } from "@/src/api/adapter";
import { POST } from "@/src/api/v1/boutiques/[key]/orders/route";

// POST /api/v1/boutiques/{key}/orders — voir src/api/v1/boutiques/[key]/orders/route.ts.
export const Route = createFileRoute("/api/v1/boutiques/$key/orders/")({
  server: { handlers: apiHandlers({ POST }) },
});
