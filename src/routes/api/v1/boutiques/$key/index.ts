import { createFileRoute } from "@tanstack/react-router";
import { apiHandlers } from "@/src/api/adapter";
import { GET } from "@/src/api/v1/boutiques/[key]/route";

// GET /api/v1/boutiques/{key} — voir src/api/v1/boutiques/[key]/route.ts.
export const Route = createFileRoute("/api/v1/boutiques/$key/")({
  server: { handlers: apiHandlers({ GET }) },
});
