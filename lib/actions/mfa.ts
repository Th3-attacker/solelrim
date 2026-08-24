"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin, requireSuperAdmin } from "@/lib/auth/admin";

export async function enrollTotpFactor(): Promise<
  { factorId: string; qrCode: string; secret: string } | { error: string }
> {
  await getCurrentAdmin();
  const supabase = await createClient();

  // A previous attempt that was never completed (closed tab, gave up on the
  // code) leaves an `unverified` factor behind — Supabase allows several,
  // but this app's UI only ever shows/creates one, so clear any stale one
  // before starting a fresh enrollment.
  const { data: existing } = await supabase.auth.mfa.listFactors();
  const stale =
    existing?.all.filter((f) => f.factor_type === "totp" && f.status === "unverified") ?? [];
  await Promise.all(stale.map((f) => supabase.auth.mfa.unenroll({ factorId: f.id })));

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
  if (error || !data) {
    return { error: "enrollFailed" };
  }

  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

export async function verifyTotpEnrollment(
  factorId: string,
  code: string,
): Promise<{ error?: string }> {
  await getCurrentAdmin();
  if (!/^\d{6}$/.test(code)) {
    return { error: "invalidCode" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) {
    return { error: "invalidCode" };
  }

  revalidatePath("/admin/settings");
  return {};
}

export async function unenrollTotpFactor(factorId: string): Promise<{ error?: string }> {
  await getCurrentAdmin();
  const supabase = await createClient();

  // A SUPERADMIN-mandated factor (setAdminMfaRequired) can't be turned off
  // by the admin it targets — the settings UI already hides this path when
  // required, but the server action is the actual enforcement, not the UI.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.app_metadata?.mfa_required === true) {
    return { error: "required" };
  }

  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) {
    return { error: "unenrollFailed" };
  }

  revalidatePath("/admin/settings");
  return {};
}

// Recovery path for an admin locked out of their authenticator app (lost
// phone, uninstalled app) — a SUPERADMIN clears their factors so they can
// re-enroll from scratch. No equivalent exists for a SUPERADMIN account
// itself (creating one is already CLI-only, see admin-users.ts) — a
// locked-out SUPERADMIN needs direct Supabase dashboard access.
export async function resetAdminMfa(adminUserId: string): Promise<{ error?: string }> {
  await requireSuperAdmin();

  const admin = await prisma.adminUser.findUnique({ where: { id: adminUserId } });
  if (!admin) {
    return { error: "invalid" };
  }

  const supabase = createAdminClient();
  const { data } = await supabase.auth.admin.mfa.listFactors({ userId: admin.supabaseUserId });
  await Promise.all(
    (data?.factors ?? []).map((f) =>
      supabase.auth.admin.mfa.deleteFactor({ id: f.id, userId: admin.supabaseUserId }),
    ),
  );

  revalidatePath("/admin/settings/global");
  return {};
}
