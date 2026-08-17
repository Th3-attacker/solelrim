import { afterEach, describe, expect, it, vi } from "vitest";
import { buildStoreUrl, jsonLdScriptProps } from "@/lib/shop/metadata";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("buildStoreUrl", () => {
  it("uses the bound custom domain with no /{storeKey} segment when one is set", () => {
    expect(
      buildStoreUrl({ domain: "solal.example.com", storeKey: "sport", path: "/products", locale: "fr" }),
    ).toBe("https://solal.example.com/fr/products");
  });

  it("falls back to the shared platform domain with a /{storeKey} segment when there is no custom domain", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://solelrim.example.com");
    expect(
      buildStoreUrl({ domain: null, storeKey: "sport", path: "/products", locale: "fr" }),
    ).toBe("https://solelrim.example.com/fr/sport/products");
  });

  it("respects the locale passed in, independent of any request context", () => {
    expect(
      buildStoreUrl({ domain: "solal.example.com", storeKey: "sport", path: "/", locale: "ar" }),
    ).toBe("https://solal.example.com/ar/");
  });
});

describe("jsonLdScriptProps", () => {
  it("serializes data to JSON", () => {
    const { __html } = jsonLdScriptProps({ "@type": "Product", name: "Tshirt" });
    expect(JSON.parse(__html)).toEqual({ "@type": "Product", name: "Tshirt" });
  });

  it("escapes '<' so a closing </script> sequence in the data can't break out of the tag", () => {
    const { __html } = jsonLdScriptProps({ name: "</script><script>alert(1)</script>" });
    expect(__html).not.toContain("</script>");
    expect(__html).toContain("\\u003c/script>");
  });
});
