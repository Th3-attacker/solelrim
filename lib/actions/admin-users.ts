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
  const { email, password, productType, canManageAppearance } = parsed.data;

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
    // Most common case in practice: retrying with an email that's already
    // a Supabase Auth user — including an orphaned one left behind by a
    // Prisma-side failure below on an earlier attempt (see the cleanup
    // comment further down). Surfaced distinctly since "Erreur" alone gives
    // no way to tell that from every other possible failure.
    return { error: error.code === "email_exists" ? "emailExists" : "createFailed" };
  }

  try {
    await prisma.adminUser.create({
      data: {
        supabaseUserId: data.user.id,
        role: "BOUTIQUE_ADMIN",
        productType,
        canManageAppearance,
      },
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

// Grants/revokes the one appearance exception (theme/color, color mode,
// hero/card layout — see requireAppearanceScope) a BOUTIQUE_ADMIN can hold.
// No effect either way for a SUPERADMIN row, but this never targets one
// anyway (same restriction as deleteBoutiqueAdmin above).
export async function setAdminCanManageAppearance(
  adminUserId: string,
  canManageAppearance: boolean,
): Promise<{ error?: string }> {
  await requireSuperAdmin();

  const admin = await prisma.adminUser.findUnique({ where: { id: adminUserId } });
  if (!admin || admin.role !== "BOUTIQUE_ADMIN") {
    return { error: "invalid" };
  }

  await prisma.adminUser.update({
    where: { id: adminUserId },
    data: { canManageAppearance },
  });

  revalidatePath("/admin/settings/global");
  return {};
}

// Lets a SUPERADMIN mandate 2FA for one specific boutique admin — proxy.ts
// blocks that admin from every page but /admin/settings until they enroll
// a TOTP factor there. Written to Supabase Auth's app_metadata (only a
// service-role client can set it) rather than a Postgres column, so the
// targeted admin has no way to clear the requirement on themselves.
export async function setAdminMfaRequired(
  adminUserId: string,
  mfaRequired: boolean,
): Promise<{ error?: string }> {
  await requireSuperAdmin();

  const admin = await prisma.adminUser.findUnique({ where: { id: adminUserId } });
  if (!admin || admin.role !== "BOUTIQUE_ADMIN") {
    return { error: "invalid" };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.auth.admin.updateUserById(admin.supabaseUserId, {
    app_metadata: { mfa_required: mfaRequired },
  });
  if (error) {
    return { error: "updateFailed" };
  }

  revalidatePath("/admin/settings/global");
  return {};
}
