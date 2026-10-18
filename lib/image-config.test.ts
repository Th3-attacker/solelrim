import { describe, expect, it } from "vitest";
import { SUPABASE_HOSTNAME_PATTERN, vercelImagesConfig } from "@/lib/image-config";

// Le motif doit reproduire `*.supabase.co` de next/image : un seul sous-domaine.
const hostname = new RegExp(SUPABASE_HOSTNAME_PATTERN);

describe("vercelImagesConfig", () => {
  it("limits the optimizer to Supabase's public storage", () => {
    const [pattern] = vercelImagesConfig().remotePatterns;
    expect(pattern.hostname).toBe(SUPABASE_HOSTNAME_PATTERN);
    expect(pattern.pathname).toBe("^/storage/v1/object/public/.*$");
  });

  it("accepts a single project subdomain", () => {
    expect(hostname.test("abcdefgh.supabase.co")).toBe(true);
  });

  it("rejects the apex, nested subdomains and look-alike hosts", () => {
    for (const host of [
      "supabase.co",
      "a.b.supabase.co",
      "evil-supabase.co",
      "x.supabase.co.evil.com",
    ]) {
      expect(hostname.test(host)).toBe(false);
    }
  });
});
