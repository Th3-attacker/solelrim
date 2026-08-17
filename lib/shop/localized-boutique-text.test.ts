import { describe, expect, it } from "vitest";
import { resolveBoutiqueText } from "@/lib/shop/localized-boutique-text";

const BOUTIQUE = {
  siteName: "Solal Sport",
  siteNameAr: "سولال سبورت",
  siteNameEn: "Solal Sports",
  heroTitle: "Bienvenue",
  heroTitleAr: null,
  heroTitleEn: null,
  heroSubtitle: "Le meilleur du sport",
  heroSubtitleAr: "",
  heroSubtitleEn: "",
  seoTitle: "Solal | Sport",
  seoTitleAr: "  ",
  seoTitleEn: "  ",
  seoDescription: "Boutique de sport",
  seoDescriptionAr: "متجر رياضي",
  seoDescriptionEn: "Sports store",
};

describe("resolveBoutiqueText", () => {
  it("uses the base (French) fields for French", () => {
    expect(resolveBoutiqueText(BOUTIQUE, "fr")).toEqual({
      siteName: "Solal Sport",
      heroTitle: "Bienvenue",
      heroSubtitle: "Le meilleur du sport",
      seoTitle: "Solal | Sport",
      seoDescription: "Boutique de sport",
    });
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

  it("prefers the English override when present and non-blank", () => {
    const resolved = resolveBoutiqueText(BOUTIQUE, "en");
    expect(resolved.siteName).toBe("Solal Sports");
    expect(resolved.seoDescription).toBe("Sports store");
  });

  it("falls back to the base field when the English override is null, empty, or blank", () => {
    const resolved = resolveBoutiqueText(BOUTIQUE, "en");
    expect(resolved.heroTitle).toBe("Bienvenue");
    expect(resolved.heroSubtitle).toBe("Le meilleur du sport");
    expect(resolved.seoTitle).toBe("Solal | Sport");
  });
});
