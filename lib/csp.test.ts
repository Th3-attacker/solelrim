import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, newNonce } from "@/lib/csp";

describe("contentSecurityPolicy", () => {
  it("allows only nonce'd scripts (and what they load) when given a nonce", () => {
    const policy = contentSecurityPolicy({ nonce: "abc", isDev: false });
    expect(policy).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).toContain("upgrade-insecure-requests");
  });

  it("falls back to inline scripts without a nonce, and adds extra sources", () => {
    const policy = contentSecurityPolicy({ extraScriptSources: ["https://cdn.jsdelivr.net"], isDev: false });
    expect(policy).toContain("script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net");
  });

  it("allows eval in development only", () => {
    expect(contentSecurityPolicy({ nonce: "abc", isDev: true })).toContain("'unsafe-eval'");
  });

  it("allows Supabase over https and wss", () => {
    expect(contentSecurityPolicy({ isDev: false })).toContain(
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    );
  });
});

describe("newNonce", () => {
  it("is fresh every time", () => {
    expect(newNonce()).not.toBe(newNonce());
    expect(newNonce()).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});
