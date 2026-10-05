import { loadOpenBoutique } from "@/lib/api/boutique";
import { fail, ok, readJson } from "@/lib/api/http";
import { getVariantStocks } from "@/lib/actions/cart";

// POST /api/v1/boutiques/{key}/stocks  { "variantIds": ["..."] }
// → { "stocks": { "<variantId>": 12 } } — refreshes a cart that may be days
// old. A variant missing from the answer no longer exists in this boutique.
export async function POST(request: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  const { boutique, response } = await loadOpenBoutique(key);
  if (!boutique) return response;

  const body = (await readJson(request)) as { variantIds?: unknown } | null;
  if (!body || !Array.isArray(body.variantIds)) return fail("invalid", 400);

  // null = invalid input or rate-limited (see getVariantStocks): the app must
  // keep its cart as it is rather than read it as "everything sold out".
  const stocks = await getVariantStocks(boutique.key, body.variantIds as string[]);
  if (stocks === null) return fail("rateLimited", 429);
  return ok({ stocks });
}
