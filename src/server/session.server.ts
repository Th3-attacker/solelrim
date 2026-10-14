import type { User } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import type { AdminUser } from "@/lib/generated/prisma/client";
import type { AdminSession } from "./admin-access";
import { createSupabaseServerClient } from "./supabase.server";

type SignIn =
  | { status: "signedOut" }
  | { status: "mfaPending" }
  | { status: "signedIn"; user: User; admin: AdminUser };

// The admin behind the current request. A Supabase account without an
// AdminUser row is no admin: it counts as signed out. An admin with 2FA who
// hasn't entered the code yet is not signed in either, for pages and server
// functions alike.
export async function loadSignIn(): Promise<SignIn> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "signedOut" };

  // A verified TOTP factor makes nextLevel "aal2" for good: the password
  // step alone reaches "aal1", so this is exactly "code still to enter".
  // Read from the session's token, no round trip.
  const [{ data: aal }, admin] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    prisma.adminUser.findUnique({ where: { supabaseUserId: user.id } }),
  ]);
  if (!admin) return { status: "signedOut" };
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") return { status: "mfaPending" };
  return { status: "signedIn", user, admin };
}

// The same, as the routing rules see it (admin-access.ts).
export async function resolveAdminSession(): Promise<AdminSession> {
  const signIn = await loadSignIn();
  if (signIn.status !== "signedIn") return signIn;
  const { user, admin } = signIn;

  // Written to app_metadata by a superadmin (setAdminMfaRequired): only a
  // service-role client can, so the admin can't clear it on themselves.
  let mfaSetupRequired = false;
  if (user.app_metadata?.mfa_required === true) {
    const { data: factors } = await createSupabaseServerClient().auth.mfa.listFactors();
    mfaSetupRequired = (factors?.totp.length ?? 0) === 0;
  }

  return {
    status: "signedIn",
    admin: { id: admin.id, email: user.email ?? "", role: admin.role },
    mfaSetupRequired,
  };
}
