import { createFileRoute } from "@tanstack/react-router";
import { apiHandlers } from "@/src/api/adapter";
import { GET } from "@/src/api/v1/openapi.json/route";

// GET /api/v1/openapi.json — voir src/api/v1/openapi.json/route.ts.
export const Route = createFileRoute("/api/v1/openapi.json/")({
  server: { handlers: apiHandlers({ GET }) },
});
