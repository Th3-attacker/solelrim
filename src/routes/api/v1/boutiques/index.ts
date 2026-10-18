import { createFileRoute } from "@tanstack/react-router";
import { apiHandlers } from "@/src/api/adapter";
import { GET } from "@/src/api/v1/boutiques/route";

// GET /api/v1/boutiques — voir src/api/v1/boutiques/route.ts.
export const Route = createFileRoute("/api/v1/boutiques/")({
  server: { handlers: apiHandlers({ GET }) },
});
