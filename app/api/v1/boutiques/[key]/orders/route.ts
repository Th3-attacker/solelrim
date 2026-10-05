import { loadOpenBoutique } from "@/lib/api/boutique";
import { fail, failFromCode } from "@/lib/api/http";
import { submitOrder } from "@/lib/actions/orders";

// POST /api/v1/boutiques/{key}/orders — multipart/form-data, the same fields
// as the website's checkout:
//   customerName, customerPhone, customerCity, paymentSenderPhone, locale,
//   items (JSON: [{ "variantId": "...", "quantity": 1 }]), promoCode (optional),
//   screenshot (the payment proof image).
// → 201 { reference, orderId }
//
// It calls submitOrder itself, so prices, stock, promo codes, the file check
// and the rate limit are the website's, not a second copy of them.
export async function POST(request: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  const { boutique, response } = await loadOpenBoutique(key);
  if (!boutique) return response;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return fail("invalid", 400);
  }
  // The boutique is the one in the URL, whatever the body claims.
  formData.set("productType", boutique.key);

  const result = await submitOrder(formData);
  if (result.error || !result.reference) return failFromCode(result.error ?? "invalid");
  return Response.json(
    { reference: result.reference, orderId: result.orderId },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
