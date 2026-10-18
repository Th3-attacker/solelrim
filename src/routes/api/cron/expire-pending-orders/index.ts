import { createFileRoute } from "@tanstack/react-router";
import { apiHandlers } from "@/src/api/adapter";
import { GET } from "@/src/api/cron/expire-pending-orders/route";

// GET /api/cron/expire-pending-orders — voir src/api/cron/expire-pending-orders/route.ts.
export const Route = createFileRoute("/api/cron/expire-pending-orders/")({
  server: { handlers: apiHandlers({ GET }) },
});
