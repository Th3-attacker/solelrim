import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
// Rate-limiting's own behavior (sliding window, IP fallback hashing) is
// covered by lib/rate-limit.test.ts — mocked wholesale here so this file
// only exercises login()/logout()'s own logic: input validation, the
// rate-limit gate, reading Supabase's result, and the locale-aware
// redirect.
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(),
}));
vi.mock("@/i18n/navigation", () => ({
  redirect: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { login, logout, verifyLoginMfa } from "@/lib/actions/auth";

const createClientMock = createClient as unknown as Mock;
const checkRateLimitMock = checkRateLimit as unknown as Mock;
const getClientIpMock = getClientIp as unknown as Mock;
const redirectMock = redirect as unknown as Mock;

function loginFormData(fields: Partial<Record<"email" | "password" | "locale", string>>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) data.set(key, value);
  }
  return data;
}

function mfaFormData(fields: Partial<Record<"code" | "locale", string>>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) data.set(key, value);
  }
  return data;
}

// Default: no factor enrolled, so nextLevel already matches currentLevel —
// the common case of an admin with no 2FA set up.
const NO_MFA_AAL = { data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null };

function asSignInResult(
  error: { message: string } | null,
  aal: { data: { currentLevel: string; nextLevel: string }; error: null } = NO_MFA_AAL,
) {
  createClientMock.mockResolvedValue({
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ error }),
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue(aal),
      },
    },
  });
}

beforeEach(() => {
  createClientMock.mockReset();
  checkRateLimitMock.mockReset();
  getClientIpMock.mockReset();
  redirectMock.mockReset();
  getClientIpMock.mockResolvedValue("203.0.113.5");
  checkRateLimitMock.mockResolvedValue(true);
});

describe("login", () => {
  it("rejects malformed input before checking the rate limit or calling Supabase", async () => {
    const result = await login(
      {},
      loginFormData({ email: "not-an-email", password: "", locale: "fr" }),
    );

    expect(result.error).toBe("invalid");
    expect(checkRateLimitMock).not.toHaveBeenCalled();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("rejects a request with a missing field", async () => {
    const result = await login({}, loginFormData({ email: "admin@example.com" }));

    expect(result.error).toBe("invalid");
    expect(checkRateLimitMock).not.toHaveBeenCalled();
  });

  it("rate-limits per client IP before ever calling Supabase", async () => {
    checkRateLimitMock.mockResolvedValue(false);

    const result = await login(
      {},
      loginFormData({ email: "admin@example.com", password: "secret", locale: "fr" }),
    );

    expect(result.error).toBe("rateLimited");
    expect(getClientIpMock).toHaveBeenCalled();
    expect(checkRateLimitMock).toHaveBeenCalledWith("login:203.0.113.5", {
      windowMs: 15 * 60 * 1000,
      max: 10,
    });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("returns a generic error on wrong credentials, without redirecting", async () => {
    asSignInResult({ message: "Invalid login credentials" });

    const result = await login(
      {},
      loginFormData({ email: "admin@example.com", password: "wrong", locale: "fr" }),
    );

    expect(result.error).toBe("invalid");
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects to /admin in the submitted locale on success", async () => {
    asSignInResult(null);

    await login(
      {},
      loginFormData({ email: "admin@example.com", password: "correct", locale: "en" }),
    );

    expect(redirectMock).toHaveBeenCalledWith({ href: "/admin", locale: "en" });
  });

  it("falls back to the default locale when the submitted locale isn't supported", async () => {
    asSignInResult(null);

    await login(
      {},
      loginFormData({ email: "admin@example.com", password: "correct", locale: "de" }),
    );

    expect(redirectMock).toHaveBeenCalledWith({
      href: "/admin",
      locale: routing.defaultLocale,
    });
  });

  it("stops at mfaRequired instead of redirecting when the admin has a verified TOTP factor", async () => {
    asSignInResult(null, {
      data: { currentLevel: "aal1", nextLevel: "aal2" },
      error: null,
    });

    const result = await login(
      {},
      loginFormData({ email: "admin@example.com", password: "correct", locale: "fr" }),
    );

    expect(result).toEqual({ mfaRequired: true });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects straight through when the session is already aal2 (no factor was pending)", async () => {
    asSignInResult(null, {
      data: { currentLevel: "aal2", nextLevel: "aal2" },
      error: null,
    });

    const result = await login(
      {},
      loginFormData({ email: "admin@example.com", password: "correct", locale: "fr" }),
    );

    expect(result).toEqual({});
    expect(redirectMock).toHaveBeenCalledWith({ href: "/admin", locale: "fr" });
  });
});

describe("verifyLoginMfa", () => {
  it("rejects a malformed code before checking the rate limit or calling Supabase", async () => {
    const result = await verifyLoginMfa({}, mfaFormData({ code: "12ab", locale: "fr" }));

    expect(result.error).toBe("invalidCode");
    expect(checkRateLimitMock).not.toHaveBeenCalled();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("rate-limits per client IP, separately from the password step", async () => {
    checkRateLimitMock.mockResolvedValue(false);

    const result = await verifyLoginMfa({}, mfaFormData({ code: "123456", locale: "fr" }));

    expect(result.error).toBe("rateLimited");
    expect(checkRateLimitMock).toHaveBeenCalledWith("login-mfa:203.0.113.5", {
      windowMs: 15 * 60 * 1000,
      max: 10,
    });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("sends an expired/missing aal1 session back to the login page", async () => {
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });

    await verifyLoginMfa({}, mfaFormData({ code: "123456", locale: "fr" }));

    expect(redirectMock).toHaveBeenCalledWith({ href: "/admin/login", locale: "fr" });
  });

  it("rejects when the admin has no verified TOTP factor to challenge", async () => {
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }),
        mfa: { listFactors: vi.fn().mockResolvedValue({ data: { totp: [] } }) },
      },
    });

    const result = await verifyLoginMfa({}, mfaFormData({ code: "123456", locale: "fr" }));

    expect(result.error).toBe("invalidCode");
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("returns invalidCode when the submitted code doesn't match", async () => {
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }),
        mfa: {
          listFactors: vi.fn().mockResolvedValue({ data: { totp: [{ id: "factor-1" }] } }),
          challengeAndVerify: vi
            .fn()
            .mockResolvedValue({ error: { message: "Invalid TOTP code entered" } }),
        },
      },
    });

    const result = await verifyLoginMfa({}, mfaFormData({ code: "000000", locale: "fr" }));

    expect(result.error).toBe("invalidCode");
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects to /admin once the code checks out", async () => {
    const challengeAndVerify = vi.fn().mockResolvedValue({ error: null });
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }),
        mfa: {
          listFactors: vi.fn().mockResolvedValue({ data: { totp: [{ id: "factor-1" }] } }),
          challengeAndVerify,
        },
      },
    });

    await verifyLoginMfa({}, mfaFormData({ code: "123456", locale: "en" }));

    expect(challengeAndVerify).toHaveBeenCalledWith({ factorId: "factor-1", code: "123456" });
    expect(redirectMock).toHaveBeenCalledWith({ href: "/admin", locale: "en" });
  });
});

describe("logout", () => {
  it("signs out of Supabase and redirects to /admin/login in the given locale", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    createClientMock.mockResolvedValue({ auth: { signOut } });

    await logout("fr");

    expect(signOut).toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith({ href: "/admin/login", locale: "fr" });
  });

  it("falls back to the default locale when given an unsupported locale", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    createClientMock.mockResolvedValue({ auth: { signOut } });

    await logout("de");

    expect(redirectMock).toHaveBeenCalledWith({
      href: "/admin/login",
      locale: routing.defaultLocale,
    });
  });
});
