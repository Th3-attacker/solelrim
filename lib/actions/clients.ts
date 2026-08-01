"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { clientSchema, type ClientInput } from "@/lib/validation/client";
import { requireAdminScope } from "@/lib/shop/admin-scope";

export type ClientActionResult = { error?: string; clientId?: string };

export async function createClientRecord(
  input: ClientInput,
): Promise<ClientActionResult> {
  const { productType } = await requireAdminScope();
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
  const { productType } = await requireAdminScope();
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "invalid" };
  }

  const updated = await prisma.client.updateMany({
    where: { id: clientId, productType },
    data: parsed.data,
  });
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
  const { productType } = await requireAdminScope();

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
