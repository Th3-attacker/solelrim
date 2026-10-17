"use server";

import { prisma } from "@/lib/prisma";
import { promoCodeSchema, type PromoCodeInput } from "@/lib/validation/promo-code";
import { PrismaClientKnownRequestError } from "@/lib/generated/prisma/internal/prismaNamespace";
import { requireWritableAdminScope } from "@/lib/auth/scope";
import { revalidateAdmin } from "@/lib/revalidate";
import { previewPromoCode as preview, type ApplyPromoCodeResult } from "@/lib/services/promo-codes";

export type PromoCodeActionResult = { error?: string; promoCodeId?: string };

export async function createPromoCode(input: PromoCodeInput): Promise<PromoCodeActionResult> {
  const { productType } = await requireWritableAdminScope();

  // Server-side feature-flag check — a BOUTIQUE_ADMIN whose boutique has
  // coupons disabled can't create one regardless of whether the "Codes
  // promo" nav item is hidden from them.
  const storeType = await prisma.storeType.findUnique({
    where: { key: productType },
    select: { couponsEnabled: true },
  });
  if (!storeType?.couponsEnabled) {
    return { error: "featureDisabled" };
  }

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
    revalidateAdmin();
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
  const { productType } = await requireWritableAdminScope();
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
    revalidateAdmin();
    return { promoCodeId };
  } catch (err) {
    if (err instanceof PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "duplicateCode" };
    }
    throw err;
  }
}

export async function deactivatePromoCode(promoCodeId: string): Promise<{ error?: string }> {
  const { productType } = await requireWritableAdminScope();

  const updated = await prisma.promoCode.updateMany({
    where: { id: promoCodeId, productType },
    data: { isActive: false },
  });
  if (updated.count === 0) {
    return { error: "notFound" };
  }

  revalidateAdmin();
  return {};
}

// The checkout's preview lives in lib/services/promo-codes.ts, shared with the
// app's API; this is the website's entry point to it.
export type { ApplyPromoCodeResult } from "@/lib/services/promo-codes";

export async function previewPromoCode(input: unknown): Promise<ApplyPromoCodeResult> {
  return preview(input);
}
