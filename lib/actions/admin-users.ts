"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/admin";
import { adminUserInputSchema } from "@/lib/validation/admin-user";

export async function createBoutiqueAdmin(
  input: unknown,
): Promise<{ error?: string }> {
  await requireSuperAdmin();
  const parsed = adminUserInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "invalid" };
  }
  const { email, password, productType } = parsed.data;

  const storeType = await prisma.storeType.findUnique({ where: { key: productType } });
  if (!storeType) {
    return { error: "invalid" };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) {
    return { error: "createFailed" };
  }

  try {
    await prisma.adminUser.create({
      data: { supabaseUserId: data.user.id, role: "BOUTIQUE_ADMIN", productType },
    });
  } catch (err) {
    // No cross-system transaction between Supabase Auth and Postgres —
    // best-effort cleanup so a Prisma-side failure doesn't leave an
    // orphaned Supabase account with no matching AdminUser row.
    await supabase.auth.admin.deleteUser(data.user.id).catch(() => {});
    throw err;
  }

  revalidatePath("/admin/settings/global");
  return {};
}

export async function deleteBoutiqueAdmin(
  adminUserId: string,
): Promise<{ error?: string }> {
  await requireSuperAdmin();

  const admin = await prisma.adminUser.findUnique({ where: { id: adminUserId } });
  // Creating/deleting another SUPERADMIN stays a CLI-only operation
  // (scripts/setup-supabase.ts) — this action only ever touches boutique
  // admins.
  if (!admin || admin.role !== "BOUTIQUE_ADMIN") {
    return { error: "invalid" };
  }

  const supabase = createAdminClient();
  await supabase.auth.admin.deleteUser(admin.supabaseUserId).catch(() => {});
  await prisma.adminUser.delete({ where: { id: adminUserId } });

  revalidatePath("/admin/settings/global");
  return {};
}
