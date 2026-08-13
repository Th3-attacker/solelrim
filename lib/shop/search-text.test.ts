import { describe, expect, it } from "vitest";
import { matchesSearch, normalizeSearchText } from "@/lib/shop/search-text";

describe("normalizeSearchText", () => {
  it("lowercases and strips accents", () => {
    expect(normalizeSearchText("Pénichè")).toBe("peniche");
    expect(normalizeSearchText("Été")).toBe("ete");
  });
});

describe("matchesSearch", () => {
  it("matches an accented product name against an unaccented query", () => {
    expect(matchesSearch("Pénichè bleue", "peniche")).toBe(true);
  });

  it("matches an unaccented product name against an accented query", () => {
    expect(matchesSearch("Chemise ete", "été")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(matchesSearch("Chaussures", "CHAUSS")).toBe(true);
  });

  it("returns false when there is no match", () => {
    expect(matchesSearch("Chaussures", "veste")).toBe(false);
  });

  it("returns false for a blank query", () => {
    expect(matchesSearch("Chaussures", "   ")).toBe(false);
  });
});
