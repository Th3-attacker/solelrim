import type { PrismaClient } from "@/lib/generated/prisma/client";
import type { TransactionClient } from "@/lib/generated/prisma/internal/prismaNamespace";
import type { Decimal } from "@/lib/generated/prisma/internal/prismaNamespace";
import type { PromoDiscountType } from "@/lib/generated/prisma/enums";

type Db = PrismaClient | TransactionClient;

export type PromoCodeValidationError =
  | "notFound"
  | "expired"
  | "usageLimitReached"
  | "notYours"
  | "alreadyUsed";

type ValidatedPromoCode = {
  id: string;
  discountType: PromoDiscountType;
  discountValue: Decimal;
  maxUses: number | null;
};

// Shared by the checkout preview (read-only) and submitOrder's transaction
// (authoritative re-check right before it increments usedCount) — a single
// source of truth for what makes a code usable, so the two never drift.
export async function findValidPromoCode(
  db: Db,
  args: { code: string; productType: string; customerPhone: string },
): Promise<{ error: PromoCodeValidationError } | { promoCode: ValidatedPromoCode }> {
  const normalized = args.code.trim().toUpperCase();
  const promoCode = await db.promoCode.findUnique({
    where: { code: normalized },
    include: { client: true },
  });

  if (!promoCode || !promoCode.isActive || promoCode.productType !== args.productType) {
    return { error: "notFound" };
  }
  if (promoCode.expiresAt && promoCode.expiresAt < new Date()) {
    return { error: "expired" };
  }
  if (promoCode.maxUses !== null && promoCode.usedCount >= promoCode.maxUses) {
    return { error: "usageLimitReached" };
  }
  // Personal code: only usable with the phone number of the client it was
  // given to. A client with no phone on file can never redeem one.
  if (promoCode.clientId && promoCode.client?.phone !== args.customerPhone) {
    return { error: "notYours" };
  }

  // One redemption per phone number, even for a general (non-personal) code
  // shared by every customer — otherwise the same person can place several
  // separate orders and consume several of a capped code's uses alone.
  // Orders that were rejected or cancelled never actually got the benefit,
  // so they don't count against this — the phone is free to try again.
  const priorRedemption = await db.order.findFirst({
    where: {
      promoCodeId: promoCode.id,
      customerPhone: args.customerPhone,
      status: { notIn: ["REJECTED", "CANCELLED"] },
    },
    select: { id: true },
  });
  if (priorRedemption) {
    return { error: "alreadyUsed" };
  }

  return { promoCode };
}

// Rounded to the currency's smallest practical unit (whole units, same as
// formatPriceNumber) and never lets a fixed-amount code exceed the subtotal.
// Plain-number core (no Decimal) so it can also run client-side, where a
// PERCENT discount needs to be re-derived from the live cart subtotal
// instead of staying frozen at whatever it was when the code was applied.
export function computeDiscountAmount(
  discountType: PromoDiscountType,
  discountValue: number,
  subtotal: number,
): number {
  const raw = discountType === "PERCENT" ? subtotal * (discountValue / 100) : discountValue;
  return Math.min(Math.round(raw), subtotal);
}

export function computePromoDiscount(
  promoCode: { discountType: PromoDiscountType; discountValue: Decimal },
  subtotal: number,
): number {
  return computeDiscountAmount(
    promoCode.discountType,
    promoCode.discountValue.toNumber(),
    subtotal,
  );
}
