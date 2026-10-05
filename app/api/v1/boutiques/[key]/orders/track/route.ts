import { loadOpenBoutique } from "@/lib/api/boutique";
import { failFromCode, ok, readJson } from "@/lib/api/http";
import { trackOrder } from "@/lib/actions/orders";

// POST /api/v1/boutiques/{key}/orders/track
//   { "phone": "37737353", "reference": "CMD-20261005-0001" }
// → { reference, status, total, createdAt, statusSince }. The reference plus
// the phone number are the customer's only credentials: there are no accounts.
export async function POST(request: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  const { boutique, response } = await loadOpenBoutique(key);
  if (!boutique) return response;

  const body = await readJson(request);
  const result = await trackOrder({ ...(body as object), productType: boutique.key });
  if ("error" in result && result.error) return failFromCode(result.error);
  return ok(result);
}
