import { createFileRoute } from "@tanstack/react-router";
import { apiHandlers } from "@/src/api/adapter";
import { GET } from "@/src/api/v1/docs/route";

// GET /api/v1/docs — voir src/api/v1/docs/route.ts.
export const Route = createFileRoute("/api/v1/docs/")({
  server: { handlers: apiHandlers({ GET }) },
});
