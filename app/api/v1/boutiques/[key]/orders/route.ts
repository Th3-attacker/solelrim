import { withApi } from "@/lib/api/trace";
import { loadOpenBoutique } from "@/lib/api/boutique";
import { fail, failFromCode } from "@/lib/api/http";
import { submitOrder } from "@/lib/actions/orders";
import { idempotencyKeySchema } from "@/lib/validation/order";

// POST /api/v1/boutiques/{key}/orders — multipart/form-data, the same fields
// as the website's checkout:
//   customerName, customerPhone, customerCity, paymentSenderPhone, locale,
//   items (JSON: [{ "variantId": "...", "quantity": 1 }]), promoCode (optional),
//   screenshot (the payment proof image).
// → 201 { reference, orderId }
//
// It calls submitOrder itself, so prices, stock, promo codes, the file check
// and the rate limit are the website's, not a second copy of them.
//
// Optional Idempotency-Key header (≤ 64 printable characters, the same on
// every resend of one order): a resend gets the first answer back instead of
// a second order — no stock or promo code taken twice (see submitOrder).
async function post(request: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  const { boutique, response } = await loadOpenBoutique(key);
  if (!boutique) return response;

  const idempotencyKey = request.headers.get("idempotency-key") ?? undefined;
  if (idempotencyKey !== undefined && !idempotencyKeySchema.safeParse(idempotencyKey).success) {
    return fail("invalid", 400);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return fail("invalid", 400);
  }
  // The boutique is the one in the URL, whatever the body claims.
  formData.set("productType", boutique.key);

  const result = await submitOrder(formData, { idempotencyKey });
  if (result.error || !result.reference) {
    return failFromCode(result.error ?? "invalid", result.retryAfter);
  }
  return Response.json(
    { reference: result.reference, orderId: result.orderId },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

export const POST = withApi(post);
