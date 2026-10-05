import { loadOpenBoutique } from "@/lib/api/boutique";
import { localeOf, ok } from "@/lib/api/http";
import { serializeBoutique } from "@/lib/api/serializers";
import { getAllShopCategories } from "@/lib/queries/shop";

// GET /api/v1/boutiques/{key}?locale=fr — one boutique's branding, payment
// details and categories.
export async function GET(request: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  const { boutique, response } = await loadOpenBoutique(key);
  if (!boutique) return response;

  const url = new URL(request.url);
  const categories = await getAllShopCategories(boutique.key);
  return ok(
    {
      ...serializeBoutique(boutique, localeOf(url), url.origin),
      categories: categories.map((category) => ({ id: category.id, name: category.name })),
    },
    { cache: true },
  );
}
