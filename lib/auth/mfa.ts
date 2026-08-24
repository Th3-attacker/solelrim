import { createClient } from "@/lib/supabase/server";

// One admin only ever has at most one active TOTP factor in this app's UI
// (enrollTotpFactor clears any stale unverified one before creating a new
// one) — so the first verified factor, if any, is the whole answer to
// "does this admin have 2FA on". `required` mirrors whatever a SUPERADMIN
// set via setAdminMfaRequired (app_metadata.mfa_required) — read straight
// off the session's own user object, no extra service-role call needed to
// check your own flag.
export async function getMfaStatus() {
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    { data: factors },
  ] = await Promise.all([supabase.auth.getUser(), supabase.auth.mfa.listFactors()]);

  return {
    factorId: factors?.totp[0]?.id ?? null,
    required: user?.app_metadata?.mfa_required === true,
  };
}
