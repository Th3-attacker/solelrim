import { loadOpenBoutique } from "@/lib/api/boutique";
import { fail, ok, pageOf } from "@/lib/api/http";
import { serializeProductSummary } from "@/lib/api/serializers";
import { getActiveProductsPage, searchActiveProducts } from "@/lib/queries/shop";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// Same budget as the website's search box: the leading wildcard in the
// search can't use an index, so it must not be callable without limit.
const SEARCH_RATE_LIMIT = { windowMs: 15 * 60 * 1000, max: 40 };

// GET /api/v1/boutiques/{key}/products?category=&q=&page=&pageSize=
export async function GET(request: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  const { boutique, response } = await loadOpenBoutique(key);
  if (!boutique) return response;

  const url = new URL(request.url);
  const categoryId = url.searchParams.get("category") ?? undefined;
  const query = url.searchParams.get("q")?.trim() ?? "";
  const { page, pageSize } = pageOf(url);

  if (query) {
    if (query.length > 100) return fail("invalid", 400);
    if (!(await checkRateLimit(`api-search:${await getClientIp()}`, SEARCH_RATE_LIMIT))) {
      return fail("rateLimited", 429);
    }
    // The search is a single capped page (best matches first), not paginated.
    const matches = await searchActiveProducts(boutique.key, query, { categoryId, take: pageSize });
    return ok({
      products: matches.map(serializeProductSummary),
      page: 1,
      pageSize,
      total: matches.length,
    });
  }

  const { items, total } = await getActiveProductsPage(boutique.key, { categoryId, page, pageSize });
  return ok({ products: items.map(serializeProductSummary), page, pageSize, total }, { cache: true });
}
