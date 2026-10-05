import { loadOpenBoutique } from "@/lib/api/boutique";
import { failFromCode, ok, readJson } from "@/lib/api/http";
import { previewPromoCode } from "@/lib/actions/promo-codes";

// POST /api/v1/boutiques/{key}/promo
//   { "code": "ETE10", "customerPhone": "37737353", "subtotal": 1500 }
// → { discountType, discountValue, discount }. Read-only: the code is only
// consumed when the order is placed.
export async function POST(request: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  const { boutique, response } = await loadOpenBoutique(key);
  if (!boutique) return response;

  const body = await readJson(request);
  const result = await previewPromoCode({ ...(body as object), productType: boutique.key });
  if ("error" in result) return failFromCode(result.error);
  return ok(result);
}
