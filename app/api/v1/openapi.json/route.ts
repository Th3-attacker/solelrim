import { withApi } from "@/lib/api/trace";
import spec from "@/docs/openapi.json";

// GET /api/v1/openapi.json — the OpenAPI 3.1 description of this API
// (docs/openapi.json), with the server set to wherever it is served from, so
// Swagger UI / openapi-typescript can be pointed straight at a deployment.
async function get(request: Request) {
  const origin = new URL(request.url).origin;
  return Response.json(
    { ...spec, servers: [{ url: `${origin}/api/v1` }] },
    { headers: { "Cache-Control": "public, s-maxage=300", "Access-Control-Allow-Origin": "*" } },
  );
}

export const GET = withApi(get);
