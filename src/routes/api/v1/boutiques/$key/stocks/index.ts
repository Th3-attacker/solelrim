import { createFileRoute } from "@tanstack/react-router";
import { apiHandlers } from "@/src/api/adapter";
import { POST } from "@/src/api/v1/boutiques/[key]/stocks/route";

// POST /api/v1/boutiques/{key}/stocks — voir src/api/v1/boutiques/[key]/stocks/route.ts.
export const Route = createFileRoute("/api/v1/boutiques/$key/stocks/")({
  server: { handlers: apiHandlers({ POST }) },
});
