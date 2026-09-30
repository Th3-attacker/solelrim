"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { PrismaClientKnownRequestError } from "@/lib/generated/prisma/internal/prismaNamespace";
import { requireWritableAdminScope, tryCheckoutScope } from "@/lib/shop/admin-scope";
import { normalizeLocalPhone } from "@/lib/shop/phone";
import { loyaltyEnrollSchema, loyaltySettingsSchema } from "@/lib/validation/loyalty";

export type LoyaltyCard = {
  clientId: string;
  name: string;
  phone: string;
  points: number;
};

export type LoyaltyCardResult = {
  error?: "invalid" | "invalidPhone" | "disabled" | "unauthorized" | "licenseBlocked";
  // null = no card for this number yet (the seller can offer to enroll).
  card?: LoyaltyCard | null;
};

const CARD_SELECT = { id: true, fullName: true, phone: true, loyaltyPoints: true } as const;

function toCard(client: { id: string; fullName: string; phone: string | null; loyaltyPoints: number }) {
  return {
    clientId: client.id,
    name: client.fullName,
    phone: client.phone ?? "",
    points: client.loyaltyPoints,
  };
}

async function isLoyaltyEnabled(productType: string) {
  const storeType = await prisma.storeType.findUnique({
    where: { key: productType },
    select: { loyaltyEnabled: true },
  });
  return storeType?.loyaltyEnabled === true;
}

function findEnrolledCard(productType: string, phone: string) {
  return prisma.client.findFirst({
    where: { productType, phone, loyaltyEnrolledAt: { not: null } },
    select: CARD_SELECT,
  });
}

// Looks a card up by phone at the checkout — only ever within the caller's
// own boutique, and only among clients who actually joined.
export async function lookupLoyaltyCard(phone: string): Promise<LoyaltyCardResult> {
  const scope = await tryCheckoutScope();
  if (scope.error) return { error: scope.error };

  const localPhone = normalizeLocalPhone(phone);
  if (!localPhone) return { error: "invalidPhone" };
  if (!(await isLoyaltyEnabled(scope.productType))) return { error: "disabled" };

  const client = await findEnrolledCard(scope.productType, localPhone);
  return { card: client ? toCard(client) : null };
}

// Opt-in enrollment, only once the customer agrees. Idempotent: an existing
// card for this number is returned as is; a client record the admin already
// created with this number is enrolled rather than duplicated.
export async function enrollLoyaltyCard(input: unknown): Promise<LoyaltyCardResult> {
  const scope = await tryCheckoutScope();
  if (scope.error) return { error: scope.error };
  const { productType } = scope;

  const parsed = loyaltyEnrollSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid" };
  const localPhone = normalizeLocalPhone(parsed.data.phone);
  if (!localPhone) return { error: "invalidPhone" };
  if (!(await isLoyaltyEnabled(productType))) return { error: "disabled" };

  const existing = await findEnrolledCard(productType, localPhone);
  if (existing) return { card: toCard(existing) };

  try {
    const unenrolled = await prisma.client.findFirst({
      where: { productType, phone: localPhone, loyaltyEnrolledAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    const client = unenrolled
      ? await prisma.client.update({
          where: { id: unenrolled.id },
          data: { loyaltyEnrolledAt: new Date() },
          select: CARD_SELECT,
        })
      : await prisma.client.create({
          data: {
            // A name is optional at the counter; the number stands in for
            // it until the admin fills one in on the client's record.
            fullName: parsed.data.name || localPhone,
            phone: localPhone,
            productType,
            loyaltyEnrolledAt: new Date(),
          },
          select: CARD_SELECT,
        });
    return { card: toCard(client) };
  } catch (err) {
    // Two counters enrolling the same number at once: the partial unique
    // index lets exactly one win — hand the loser the winner's card.
    if (err instanceof PrismaClientKnownRequestError && err.code === "P2002") {
      const winner = await findEnrolledCard(productType, localPhone);
      if (winner) return { card: toCard(winner) };
    }
    throw err;
  }
}

// The boutique's loyalty rule — its admin's call, never a seller's
// (requireWritableAdminScope refuses the SELLER role).
export async function updateLoyaltySettings(input: unknown): Promise<{ error?: string }> {
  const { productType } = await requireWritableAdminScope();
  const parsed = loyaltySettingsSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid" };

  await prisma.storeType.update({
    where: { key: productType },
    data: {
      loyaltyEnabled: parsed.data.enabled,
      loyaltySpendPerPoint: parsed.data.spendPerPoint,
      loyaltyRewardPoints: parsed.data.rewardPoints,
      loyaltyRewardValue: parsed.data.rewardValue,
    },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin/pos");
  return {};
}
