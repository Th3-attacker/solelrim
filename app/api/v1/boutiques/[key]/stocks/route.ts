import { withApi } from "@/lib/api/trace";
import { loadOpenBoutique } from "@/lib/api/boutique";
import { fail, failFromCode, ok, readJson } from "@/lib/api/http";
import { checkVariantStocks } from "@/lib/actions/cart";

// POST /api/v1/boutiques/{key}/stocks  { "variantIds": ["..."] }
// → { "stocks": { "<variantId>": 12 } } — refreshes a cart that may be days
// old. A variant missing from the answer no longer exists in this boutique.
async function post(request: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  const { boutique, response } = await loadOpenBoutique(key);
  if (!boutique) return response;

  const body = (await readJson(request)) as { variantIds?: unknown } | null;
  if (!body || !Array.isArray(body.variantIds)) return fail("invalid", 400);

  // On an error the app keeps its cart as it is rather than read it as
  // "everything sold out": 400 for a malformed list (over 50 ids, a non-string
  // id), 429 with Retry-After when rate-limited.
  const result = await checkVariantStocks(boutique.key, body.variantIds as string[]);
  if ("error" in result) return failFromCode(result.error, "retryAfter" in result ? result.retryAfter : undefined);
  return ok(result);
}

export const POST = withApi(post);
