"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { PrismaClientKnownRequestError } from "@/lib/generated/prisma/internal/prismaNamespace";
import { clientSchema, type ClientInput } from "@/lib/validation/client";
import { requireWritableAdminScope } from "@/lib/shop/admin-scope";

export type ClientActionResult = { error?: string; clientId?: string };

export async function createClientRecord(
  input: ClientInput,
): Promise<ClientActionResult> {
  const { productType } = await requireWritableAdminScope();
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "invalid" };
  }

  const created = await prisma.client.create({
    data: { ...parsed.data, productType },
  });
  revalidatePath("/admin/clients");
  return { clientId: created.id };
}

export async function updateClientRecord(
  clientId: string,
  input: ClientInput,
): Promise<ClientActionResult> {
  const { productType } = await requireWritableAdminScope();
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "invalid" };
  }

  // The number *is* a loyalty card: clearing it would strand the points
  // (the card could no longer be looked up, and re-enrolling the number
  // would open a second one).
  if (!parsed.data.phone) {
    const enrolled = await prisma.client.findFirst({
      where: { id: clientId, productType, loyaltyEnrolledAt: { not: null } },
      select: { id: true },
    });
    if (enrolled) {
      return { error: "loyaltyPhoneRequired" };
    }
  }

  let updated;
  try {
    updated = await prisma.client.updateMany({
      where: { id: clientId, productType },
      data: parsed.data,
    });
  } catch (err) {
    // Client_loyalty_phone_key: another card already uses this number.
    if (err instanceof PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "loyaltyPhoneTaken" };
    }
    throw err;
  }
  if (updated.count === 0) {
    return { error: "notFound" };
  }
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${clientId}`);
  return { clientId };
}

export async function deleteClient(
  clientId: string,
): Promise<{ error?: string }> {
  const { productType } = await requireWritableAdminScope();

  const client = await prisma.client.findFirst({
    where: { id: clientId, productType },
    select: { id: true },
  });
  if (!client) {
    return { error: "notFound" };
  }

  const salesCount = await prisma.sale.count({ where: { clientId } });
  if (salesCount > 0) {
    return { error: "hasSales" };
  }

  await prisma.client.delete({ where: { id: clientId } });
  revalidatePath("/admin/clients");
  return {};
}
