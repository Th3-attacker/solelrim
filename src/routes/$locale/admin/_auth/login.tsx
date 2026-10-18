import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { LoginForm } from "@/components/auth/login-form";
import { createClient } from "@/lib/supabase/server";

// Ex-app/[locale]/admin/(auth)/login/page.tsx.
const getLoginStep = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The request middleware only ever lets this page render for two cases: no
  // session at all (password step), or a session stuck at aal1 needing its
  // TOTP code (mfa step) — this mirrors that same check to pick the right one.
  let initialStep: "credentials" | "mfa" = "credentials";
  if (user) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      initialStep = "mfa";
    }
  }
  return initialStep;
});

export const Route = createFileRoute("/$locale/admin/_auth/login")({
  loader: () => getLoginStep(),
  component: LoginPage,
});

function LoginPage() {
  return <LoginForm initialStep={Route.useLoaderData()} />;
}
