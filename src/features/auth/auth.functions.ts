import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { prisma } from "@/lib/prisma";
import { clientIpFromHeaders } from "@/lib/client-ip";
import { RATE_LIMITS, checkRateLimit } from "@/lib/rate-limit-store";
import { resolveAdminSession } from "~/server/session.server";
import { createSupabaseServerClient } from "~/server/supabase.server";
import { loginSchema, mfaCodeSchema } from "./auth.schemas";

// Sign-in, its 2FA step and sign-out, ported from lib/actions/auth.ts. They
// answer with a status the form shows; the page moves on by itself.

export type LoginResult =
  { status: "signedIn" | "mfaRequired" } | { error: "invalid" | "rateLimited" };
export type MfaResult =
  { status: "signedIn" | "restart" } | { error: "invalidCode" | "rateLimited" };

export const getAdminSession = createServerFn({ method: "GET" }).handler(() =>
  resolveAdminSession(),
);

export const login = createServerFn({ method: "POST" })
  .validator(loginSchema)
  .handler(async ({ data: { email, password } }): Promise<LoginResult> => {
    // Unauthenticated by definition: capped per address and per account, so
    // one admin's password can't be guessed from many addresses either.
    const ip = clientIpFromHeaders(getRequest().headers);
    const [ipAllowed, accountAllowed] = await Promise.all([
      checkRateLimit(`login:${ip}`, RATE_LIMITS.loginPerIp),
      checkRateLimit(`login-email:${email.toLowerCase()}`, RATE_LIMITS.loginPerEmail),
    ]);
    if (!ipAllowed || !accountAllowed) return { error: "rateLimited" };

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return { error: "invalid" };

    // A Supabase account that isn't an admin gets the same answer as a wrong
    // password, and leaves no session behind.
    const admin = await prisma.adminUser.findUnique({
      where: { supabaseUserId: data.user.id },
      select: { id: true },
    });
    if (!admin) {
      await supabase.auth.signOut();
      return { error: "invalid" };
    }

    // The password alone reaches "aal1": with a verified factor, the code
    // step is still ahead. Without one, both levels already agree.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") return { status: "mfaRequired" };
    return { status: "signedIn" };
  });

// The second step, on the "aal1" session the password step left in the
// cookies, not on the password again.
export const verifyLoginMfa = createServerFn({ method: "POST" })
  .validator(mfaCodeSchema)
  .handler(async ({ data: { code } }): Promise<MfaResult> => {
    // Counted apart from the password step: guessing the 6-digit code is a
    // different attack and must not share (or exhaust) the same counters.
    const ip = clientIpFromHeaders(getRequest().headers);
    if (!(await checkRateLimit(`login-mfa:${ip}`, RATE_LIMITS.mfaPerIp))) {
      return { error: "rateLimited" };
    }

    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    // No session to step up from (expired, or the tab reopened days later):
    // back to the password instead of a dead end.
    if (!user) return { status: "restart" };
    // Per account too: the stolen password's owner is the one being guessed.
    if (!(await checkRateLimit(`login-mfa-user:${user.id}`, RATE_LIMITS.mfaPerUser))) {
      return { error: "rateLimited" };
    }

    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp[0];
    if (!factor) return { error: "invalidCode" };

    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (error) return { error: "invalidCode" };
    return { status: "signedIn" };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  await createSupabaseServerClient().auth.signOut();
});
