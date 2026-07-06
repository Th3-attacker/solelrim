"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { clientSchema, type ClientInput } from "@/lib/validation/client";

async function requireAdmin() {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");
}

export type ClientActionResult = { error?: string; clientId?: string };

export async function createClientRecord(
  input: ClientInput,
): Promise<ClientActionResult> {
  await requireAdmin();
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "invalid" };
  }

  const created = await prisma.client.create({ data: parsed.data });
  revalidatePath("/admin/clients");
  return { clientId: created.id };
}

export async function updateClientRecord(
  clientId: string,
  input: ClientInput,
): Promise<ClientActionResult> {
  await requireAdmin();
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "invalid" };
  }

  await prisma.client.update({ where: { id: clientId }, data: parsed.data });
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${clientId}`);
  return { clientId };
}

export async function deleteClient(
  clientId: string,
): Promise<{ error?: string }> {
  await requireAdmin();

  const salesCount = await prisma.sale.count({ where: { clientId } });
  if (salesCount > 0) {
    return { error: "hasSales" };
  }

  await prisma.client.delete({ where: { id: clientId } });
  revalidatePath("/admin/clients");
  return {};
}
