import { withApi } from "@/lib/api/trace";
import { loadOpenBoutique } from "@/lib/api/boutique";
import { fail, failFromCode } from "@/lib/api/http";
import { submitOrder } from "@/lib/actions/orders";
import { findOrderByIdempotencyKey } from "@/lib/queries/orders";

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
// a second order — no stock or promo code taken twice.
const IDEMPOTENCY_KEY = /^[\x21-\x7e]{1,64}$/;

function created(order: { reference: string; orderId?: string }) {
  return Response.json(
    { reference: order.reference, orderId: order.orderId },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

async function post(request: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  const { boutique, response } = await loadOpenBoutique(key);
  if (!boutique) return response;

  const idempotencyKey = request.headers.get("idempotency-key") ?? undefined;
  if (idempotencyKey !== undefined && !IDEMPOTENCY_KEY.test(idempotencyKey)) {
    return fail("invalid", 400);
  }
  if (idempotencyKey) {
    const existing = await findOrderByIdempotencyKey(boutique.key, idempotencyKey);
    if (existing) return created(existing);
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
    // Two resends running side by side: the one that lost may stop early
    // (the winner took the last unit, or the rate limit) — the order exists
    // all the same, so it gets the same 201.
    if (idempotencyKey) {
      const existing = await findOrderByIdempotencyKey(boutique.key, idempotencyKey);
      if (existing) return created(existing);
    }
    return failFromCode(result.error ?? "invalid", result.retryAfter);
  }
  return created({ reference: result.reference, orderId: result.orderId });
}

export const POST = withApi(post);
