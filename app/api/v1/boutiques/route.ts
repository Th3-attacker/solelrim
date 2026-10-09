import { withApi } from "@/lib/api/trace";
import { listOpenBoutiques } from "@/lib/api/boutique";
import { localeOf, ok } from "@/lib/api/http";
import { serializeBoutique } from "@/lib/api/serializers";

// GET /api/v1/boutiques?locale=fr — the boutiques the app lets the customer
// choose from.
async function get(request: Request) {
  const url = new URL(request.url);
  const locale = localeOf(url);
  const boutiques = await listOpenBoutiques();
  return ok(
    { boutiques: boutiques.map((boutique) => serializeBoutique(boutique, locale, url.origin)) },
    { cache: true },
  );
}

export const GET = withApi(get);
