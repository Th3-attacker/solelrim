import { prisma } from "@/lib/prisma";
import type { AdminSession } from "./admin-access";
import { createSupabaseServerClient } from "./supabase.server";

// The admin behind the current request, as the routing rules see it
// (admin-access.ts). Same checks as proxy.ts plus the AdminUser row: a
// Supabase account without one is no admin, so it counts as signed out.
export async function resolveAdminSession(): Promise<AdminSession> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "signedOut" };

  // A verified TOTP factor makes nextLevel "aal2" for good: the password
  // step alone reaches "aal1", so this is exactly "code still to enter".
  const [{ data: aal }, admin] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    prisma.adminUser.findUnique({
      where: { supabaseUserId: user.id },
      select: { id: true, role: true },
    }),
  ]);
  if (!admin) return { status: "signedOut" };
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") return { status: "mfaPending" };

  // Written to app_metadata by a superadmin (setAdminMfaRequired): only a
  // service-role client can, so the admin can't clear it on themselves.
  let mfaSetupRequired = false;
  if (user.app_metadata?.mfa_required === true) {
    const { data: factors } = await supabase.auth.mfa.listFactors();
    mfaSetupRequired = (factors?.totp.length ?? 0) === 0;
  }

  return {
    status: "signedIn",
    admin: { id: admin.id, email: user.email ?? "", role: admin.role },
    mfaSetupRequired,
  };
}
