"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  promoCodeSchema,
  applyPromoCodeSchema,
  type PromoCodeInput,
} from "@/lib/validation/promo-code";
import { PrismaClientKnownRequestError } from "@/lib/generated/prisma/internal/prismaNamespace";
import { requireAdminScope } from "@/lib/shop/admin-scope";
import { findValidPromoCode, computePromoDiscount } from "@/lib/shop/promo-code";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export type PromoCodeActionResult = { error?: string; promoCodeId?: string };

export async function createPromoCode(
  input: PromoCodeInput,
): Promise<PromoCodeActionResult> {
  const { productType } = await requireAdminScope();
  const parsed = promoCodeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "invalid" };
  }
  const { clientId, expiresAt, maxUses, code, discountType, discountValue } = parsed.data;

  // A boutique admin could otherwise gift a code to a client outside their
  // own boutique by guessing an id — same ownership check as everywhere
  // else a foreign id crosses a tenant boundary.
  if (clientId) {
    const client = await prisma.client.findFirst({
      where: { id: clientId, productType },
      select: { id: true },
    });
    if (!client) {
      return { error: "invalid" };
    }
  }

  try {
    const created = await prisma.promoCode.create({
      data: {
        code,
        discountType,
        discountValue,
        clientId,
        productType,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        maxUses,
      },
    });
    revalidatePath("/admin/promo-codes");
    revalidatePath("/admin/clients");
    return { promoCodeId: created.id };
  } catch (err) {
    if (err instanceof PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "duplicateCode" };
    }
    throw err;
  }
}

export async function updatePromoCode(
  promoCodeId: string,
  input: PromoCodeInput,
): Promise<PromoCodeActionResult> {
  const { productType } = await requireAdminScope();
  const parsed = promoCodeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "invalid" };
  }
  const { clientId, expiresAt, maxUses, code, discountType, discountValue } = parsed.data;

  if (clientId) {
    const client = await prisma.client.findFirst({
      where: { id: clientId, productType },
      select: { id: true },
    });
    if (!client) {
      return { error: "invalid" };
    }
  }

  try {
    const updated = await prisma.promoCode.updateMany({
      where: { id: promoCodeId, productType },
      data: {
        code,
        discountType,
        discountValue,
        clientId,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        maxUses,
      },
    });
    if (updated.count === 0) {
      return { error: "notFound" };
    }
    revalidatePath("/admin/promo-codes");
    revalidatePath("/admin/clients");
    return { promoCodeId };
  } catch (err) {
    if (err instanceof PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "duplicateCode" };
    }
    throw err;
  }
}

export async function deactivatePromoCode(
  promoCodeId: string,
): Promise<{ error?: string }> {
  const { productType } = await requireAdminScope();

  const updated = await prisma.promoCode.updateMany({
    where: { id: promoCodeId, productType },
    data: { isActive: false },
  });
  if (updated.count === 0) {
    return { error: "notFound" };
  }

  revalidatePath("/admin/promo-codes");
  revalidatePath("/admin/clients");
  return {};
}

export type ApplyPromoCodeResult =
  | { error: string }
  | { discountType: "PERCENT" | "FIXED"; discountValue: number; discount: number };

const APPLY_PROMO_RATE_LIMIT = { windowMs: 15 * 60 * 1000, max: 20 };

// Public, unauthenticated preview for the checkout UI — read-only, never
// touches usedCount. submitOrder re-validates the same code from scratch
// inside its own transaction and is the only place one is actually
// consumed, so this preview is UX sugar, not a security boundary.
export async function previewPromoCode(
  input: unknown,
): Promise<ApplyPromoCodeResult> {
  const ip = await getClientIp();
  const allowed = await checkRateLimit(`promo:${ip}`, APPLY_PROMO_RATE_LIMIT);
  if (!allowed) {
    return { error: "rateLimited" };
  }

  const parsed = applyPromoCodeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "invalid" };
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
