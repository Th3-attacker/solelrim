"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  locale: z.string(),
});

export type LoginState = { error?: string; mfaRequired?: boolean };

// Unauthenticated by definition — capped per IP so the admin password can't
// be brute-forced. 10/15min is loose enough for a legitimate typo or two.
const LOGIN_RATE_LIMIT = { windowMs: 15 * 60 * 1000, max: 10 };

function resolveLoginLocale(locale: string) {
  return routing.locales.includes(locale as (typeof routing.locales)[number])
    ? locale
    : routing.defaultLocale;
}

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    locale: formData.get("locale"),
  });

  if (!parsed.success) {
    return { error: "invalid" };
  }

  const ip = await getClientIp();
  const allowed = await checkRateLimit(`login:${ip}`, LOGIN_RATE_LIMIT);
  if (!allowed) {
    return { error: "rateLimited" };
  }

  const { email, password, locale } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "invalid" };
  }

  // signInWithPassword alone only ever reaches "aal1" — an admin with a
  // verified TOTP factor still needs the code step before nextLevel and
  // currentLevel match at "aal2". No factor enrolled means the two levels
  // already agree here, so this is a no-op for most admins.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    return { mfaRequired: true };
  }

  redirect({ href: "/admin", locale: resolveLoginLocale(locale) });
  return {};
}

const mfaSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
  locale: z.string(),
});

export type MfaState = { error?: string };

// Same budget as LOGIN_RATE_LIMIT, keyed separately — a brute force of the
// 6-digit code is a distinct attack from password guessing and shouldn't
// share (or exhaust) the same counter.
const MFA_RATE_LIMIT = { windowMs: 15 * 60 * 1000, max: 10 };

// The second step of login, submitted from the same page once `login`
// above returns mfaRequired — relies on the aal1 session signInWithPassword
// already created (via the request's cookies), not on email/password again.
export async function verifyLoginMfa(
  _prevState: MfaState,
  formData: FormData,
): Promise<MfaState> {
  const parsed = mfaSchema.safeParse({
    code: formData.get("code"),
    locale: formData.get("locale"),
  });
  if (!parsed.success) {
    return { error: "invalidCode" };
  }

  const ip = await getClientIp();
  const allowed = await checkRateLimit(`login-mfa:${ip}`, MFA_RATE_LIMIT);
  if (!allowed) {
    return { error: "rateLimited" };
  }

  const { code, locale } = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // No aal1 session to step up from (expired, or the tab was reopened
    // days later) — back to square one instead of a dead-end error.
    redirect({ href: "/admin/login", locale: resolveLoginLocale(locale) });
    return {};
  }

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp[0];
  if (!factor) {
    return { error: "invalidCode" };
  }

  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code,
  });
  if (error) {
    return { error: "invalidCode" };
  }

  redirect({ href: "/admin", locale: resolveLoginLocale(locale) });
  return {};
}

export async function logout(locale: string) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect({ href: "/admin/login", locale: resolveLoginLocale(locale) });
}
