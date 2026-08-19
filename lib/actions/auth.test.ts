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
import { login, logout } from "@/lib/actions/auth";

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

function asSignInResult(error: { message: string } | null) {
  createClientMock.mockResolvedValue({
    auth: { signInWithPassword: vi.fn().mockResolvedValue({ error }) },
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
