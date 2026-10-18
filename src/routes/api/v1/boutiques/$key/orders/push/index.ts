import { createFileRoute } from "@tanstack/react-router";
import { apiHandlers } from "@/src/api/adapter";
import { POST, DELETE } from "@/src/api/v1/boutiques/[key]/orders/push/route";

// POST, DELETE /api/v1/boutiques/{key}/orders/push — voir src/api/v1/boutiques/[key]/orders/push/route.ts.
export const Route = createFileRoute("/api/v1/boutiques/$key/orders/push/")({
  server: { handlers: apiHandlers({ POST, DELETE }) },
});
