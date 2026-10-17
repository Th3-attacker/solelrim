import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildSocialMetadata,
  buildStoreUrl,
  jsonLdScriptProps,
  ogLocale,
} from "@/lib/shop/metadata";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("buildStoreUrl", () => {
  it("uses the bound custom domain with no /{storeKey} segment when one is set", () => {
    expect(
      buildStoreUrl({
        domain: "solal.example.com",
        storeKey: "sport",
        path: "/products",
        locale: "fr",
      }),
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

describe("ogLocale", () => {
  it("maps each app locale to its Open Graph language_TERRITORY form", () => {
    expect(ogLocale("fr")).toBe("fr_FR");
    expect(ogLocale("en")).toBe("en_US");
    expect(ogLocale("ar")).toBe("ar_MR");
  });

  it("falls back to the bare locale for an unknown locale instead of throwing", () => {
    expect(ogLocale("es")).toBe("es");
  });
});

describe("buildSocialMetadata", () => {
  it("emits openGraph.locale as language_TERRITORY, not the bare app locale", () => {
    const { openGraph } = buildSocialMetadata({
      title: "Tshirt de sport — SOLAL",
      description: "Description.",
      imageUrl: null,
      locale: "fr",
      domain: null,
      storeKey: "sport",
      path: "",
      siteName: "SOLAL",
    });
    expect(openGraph?.locale).toBe("fr_FR");
  });

  it("keeps the canonical and hreflang alternates on the boutique's URLs", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.solal-rim.com");
    const { alternates } = buildSocialMetadata({
      title: "Tshirt de sport — SOLAL",
      description: "Description.",
      imageUrl: null,
      locale: "fr",
      domain: null,
      storeKey: "sport",
      path: "/products/tshirt",
      siteName: "SOLAL",
    });
    expect(alternates?.canonical).toBe("https://www.solal-rim.com/fr/sport/products/tshirt");
    expect(alternates?.languages).toEqual({
      fr: "https://www.solal-rim.com/fr/sport/products/tshirt",
      en: "https://www.solal-rim.com/en/sport/products/tshirt",
      ar: "https://www.solal-rim.com/ar/sport/products/tshirt",
      "x-default": "https://www.solal-rim.com/fr/sport/products/tshirt",
    });
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
