import { withApi } from "@/lib/api/trace";
import { loadOpenBoutique } from "@/lib/api/boutique";
import { fail, ok } from "@/lib/api/http";
import { serializeProductDetail } from "@/lib/api/serializers";
import { getActiveProductBySlug } from "@/lib/queries/shop";

// GET /api/v1/boutiques/{key}/products/{slug}
async function get(
  _request: Request,
  ctx: { params: Promise<{ key: string; slug: string }> },
) {
  const { key, slug } = await ctx.params;
  const { boutique, response } = await loadOpenBoutique(key);
  if (!boutique) return response;

  const product = await getActiveProductBySlug(slug, boutique.key);
  if (!product) return fail("notFound", 404);
  return ok(serializeProductDetail(product), { cache: true });
}

export const GET = withApi(get);
