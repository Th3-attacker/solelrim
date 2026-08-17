import { describe, expect, it } from "vitest";
import { resolveBoutiqueText } from "@/lib/shop/localized-boutique-text";

const BOUTIQUE = {
  siteName: "Solal Sport",
  siteNameAr: "سولال سبورت",
  heroTitle: "Bienvenue",
  heroTitleAr: null,
  heroSubtitle: "Le meilleur du sport",
  heroSubtitleAr: "",
  seoTitle: "Solal | Sport",
  seoTitleAr: "  ",
  seoDescription: "Boutique de sport",
  seoDescriptionAr: "متجر رياضي",
};

describe("resolveBoutiqueText", () => {
  it("uses the base (French) fields for a non-Arabic locale", () => {
    expect(resolveBoutiqueText(BOUTIQUE, "fr")).toEqual({
      siteName: "Solal Sport",
      heroTitle: "Bienvenue",
      heroSubtitle: "Le meilleur du sport",
      seoTitle: "Solal | Sport",
      seoDescription: "Boutique de sport",
    });
  });

  it("uses the base fields for English too — there is no separate en column", () => {
    expect(resolveBoutiqueText(BOUTIQUE, "en").siteName).toBe("Solal Sport");
  });

  it("prefers the Arabic override when present and non-blank", () => {
    const resolved = resolveBoutiqueText(BOUTIQUE, "ar");
    expect(resolved.siteName).toBe("سولال سبورت");
    expect(resolved.seoDescription).toBe("متجر رياضي");
  });

  it("falls back to the base field when the Arabic override is null, empty, or blank", () => {
    const resolved = resolveBoutiqueText(BOUTIQUE, "ar");
    expect(resolved.heroTitle).toBe("Bienvenue");
    expect(resolved.heroSubtitle).toBe("Le meilleur du sport");
    expect(resolved.seoTitle).toBe("Solal | Sport");
  });
});
