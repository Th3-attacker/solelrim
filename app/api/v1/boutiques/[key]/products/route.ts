import { withApi } from "@/lib/api/trace";
import { loadOpenBoutique } from "@/lib/api/boutique";
import { catalogueParamsOf, fail, ok, pageOf } from "@/lib/api/http";
import { serializeFacets, serializeProductSummary } from "@/lib/api/serializers";
import {
  getActiveProductsPage,
  getCatalogueFacets,
  getFilteredProductsPage,
  searchActiveProducts,
} from "@/lib/queries/shop";
import { getClientIp, RATE_LIMITS, rateLimitRetryAfter } from "@/lib/rate-limit";

// GET /api/v1/boutiques/{key}/products?category=&q=&page=&pageSize=
//   &sort=&sizes=&colors=&priceMin=&priceMax=&facets=1
// Without sort/filters/facets: exactly the answer from before they existed
// (installed apps rely on it), the search included. With any of them: the
// filtered catalogue (lib/queries/catalogue-filters.ts), paginated with its
// real total, the search too.
async function get(request: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  const { boutique, response } = await loadOpenBoutique(key);
  if (!boutique) return response;

  const url = new URL(request.url);
  const categoryId = url.searchParams.get("category") ?? undefined;
  const query = url.searchParams.get("q")?.trim() ?? "";
  const { page, pageSize } = pageOf(url);
  const catalogue = catalogueParamsOf(url);
  if (catalogue === "invalid") return fail("invalid", 400);

  if (query) {
    if (query.length > 100) return fail("invalid", 400);
    const wait = await rateLimitRetryAfter(
      `api-search:${await getClientIp()}`,
      RATE_LIMITS.searchPerIp,
    );
    if (wait !== null) return fail("rateLimited", 429, { "Retry-After": String(wait) });
  }

  if (catalogue) {
    const filters = {
      productType: boutique.key,
      categoryId,
      query: query || undefined,
      sort: catalogue.sort,
      sizes: catalogue.sizes,
      colors: catalogue.colors,
      priceMin: catalogue.priceMin,
      priceMax: catalogue.priceMax,
    };
    const [{ items, total }, facets] = await Promise.all([
      getFilteredProductsPage(filters, { page, pageSize }),
      catalogue.facets ? getCatalogueFacets(filters) : null,
    ]);
    return ok(
      {
        products: items.map(serializeProductSummary),
        page,
        pageSize,
        total,
        ...(facets ? { facets: serializeFacets(facets) } : {}),
      },
      // Searches aren't cached, as before.
      { cache: !query },
    );
  }

  if (query) {
    // The search is a single capped page (best matches first), not paginated.
    const matches = await searchActiveProducts(boutique.key, query, { categoryId, take: pageSize });
    return ok({
      products: matches.map(serializeProductSummary),
      page: 1,
      pageSize,
      total: matches.length,
    });
  }

  const { items, total } = await getActiveProductsPage(boutique.key, {
    categoryId,
    page,
    pageSize,
  });
  return ok(
    { products: items.map(serializeProductSummary), page, pageSize, total },
    { cache: true },
  );
}

export const GET = withApi(get);
