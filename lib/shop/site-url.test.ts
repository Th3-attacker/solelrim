import { afterEach, describe, expect, it, vi } from "vitest";
import { getSiteUrl } from "@/lib/shop/site-url";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getSiteUrl", () => {
  it("prefers an explicit NEXT_PUBLIC_SITE_URL, with any trailing slash stripped", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://solelrim.example.com/");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "solelrim.vercel.app");
    expect(getSiteUrl()).toBe("https://solelrim.example.com");
  });

  it("falls back to Vercel's production domain when no explicit site URL is set", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "solelrim.vercel.app");
    expect(getSiteUrl()).toBe("https://solelrim.vercel.app");
  });

  it("falls back to localhost when nothing is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    expect(getSiteUrl()).toBe("http://localhost:3000");
  });
});
