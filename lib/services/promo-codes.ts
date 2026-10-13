import "server-only";
import { prisma } from "@/lib/prisma";
import { applyPromoCodeSchema } from "@/lib/validation/promo-code";
import { findValidPromoCode, computePromoDiscount } from "@/lib/shop/promo-code";
import { getClientIp, RATE_LIMITS, rateLimitRetryAfter } from "@/lib/rate-limit";

export type ApplyPromoCodeResult =
  | { error: string; retryAfter?: number }
  | { discountType: "PERCENT" | "FIXED"; discountValue: number; discount: number };

// Public, unauthenticated preview for the checkout UI — read-only, never
// touches usedCount. submitOrder re-validates the same code from scratch
// inside its own transaction and is the only place one is actually
// consumed, so this preview is UX sugar, not a security boundary.
export async function previewPromoCode(
  input: unknown,
): Promise<ApplyPromoCodeResult> {
  const ip = await getClientIp();
  const ipWait = await rateLimitRetryAfter(`promo:${ip}`, RATE_LIMITS.promoPerIp);
  if (ipWait !== null) {
    return { error: "rateLimited", retryAfter: ipWait };
  }

  const parsed = applyPromoCodeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "invalid" };
  }
  const phoneWait = await rateLimitRetryAfter(
    `promo-phone:${parsed.data.customerPhone}`,
    RATE_LIMITS.promoPerPhone,
  );
  if (phoneWait !== null) {
    return { error: "rateLimited", retryAfter: phoneWait };
  }

  const result = await findValidPromoCode(prisma, parsed.data);
  if ("error" in result) {
    return { error: result.error };
  }

  const discount = computePromoDiscount(result.promoCode, parsed.data.subtotal);
  return {
    discountType: result.promoCode.discountType,
    discountValue: result.promoCode.discountValue.toNumber(),
    discount,
  };
}
