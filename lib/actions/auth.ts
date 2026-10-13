"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  locale: z.string(),
});

export type LoginState = { error?: string; mfaRequired?: boolean };

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

  const { email, password, locale } = parsed.data;

  // Unauthenticated by definition: capped per address and per account, so
  // one admin's password can't be guessed from many addresses either.
  const ip = await getClientIp();
  const [ipAllowed, accountAllowed] = await Promise.all([
    checkRateLimit(`login:${ip}`, RATE_LIMITS.loginPerIp),
    checkRateLimit(`login-email:${email.toLowerCase()}`, RATE_LIMITS.loginPerEmail),
  ]);
  if (!ipAllowed || !accountAllowed) {
    return { error: "rateLimited" };
  }

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

  // Counted apart from the password step: guessing the 6-digit code is a
  // different attack and must not share (or exhaust) the same counters.
  const ip = await getClientIp();
  if (!(await checkRateLimit(`login-mfa:${ip}`, RATE_LIMITS.mfaPerIp))) {
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
  // Per account too: the stolen password's owner is the one being guessed.
  if (!(await checkRateLimit(`login-mfa-user:${user.id}`, RATE_LIMITS.mfaPerUser))) {
    return { error: "rateLimited" };
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
