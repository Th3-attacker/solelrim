import { LoginForm } from "@/components/auth/login-form";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // proxy.ts only ever lets this page render for two cases: no session at
  // all (password step), or a session stuck at aal1 needing its TOTP code
  // (mfa step) — this mirrors that same check to pick the right one.
  let initialStep: "credentials" | "mfa" = "credentials";
  if (user) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      initialStep = "mfa";
    }
  }

  return <LoginForm initialStep={initialStep} />;
}
