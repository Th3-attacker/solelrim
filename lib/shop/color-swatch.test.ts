import { describe, expect, it } from "vitest";
import { getSwatchColors, getSwatchColor, getSwatchStyle, lookupSwatchHexes } from "@/lib/shop/color-swatch";

describe("getSwatchColors", () => {
  it("resolves a known French color name", () => {
    expect(getSwatchColors("Noir")).toEqual(["#18181b"]);
  });

  it("resolves a known English color name case-insensitively", () => {
    expect(getSwatchColors("WHITE")).toEqual(["#ffffff"]);
  });

  it("falls back to the neutral color for an unmapped name", () => {
    expect(getSwatchColors("Chartreuse")).toEqual(["#a1a1aa"]);
  });

  it("resolves common fashion color names like olive", () => {
    expect(getSwatchColors("Olive")).toEqual(["#6b7a3a"]);
    expect(getSwatchColors("kaki")).toEqual(["#7d7a54"]);
  });

  it("resolves the extended fashion palette (charcoal, terracotta, cognac)", () => {
    expect(getSwatchColors("Charbon")).toEqual(["#374151"]);
    expect(getSwatchColors("Terracotta")).toEqual(["#c2410c"]);
    expect(getSwatchColors("cognac")).toEqual(["#7c4a1e"]);
  });

  it("still falls back to neutral for an accented name it doesn't know", () => {
    expect(getSwatchColors("Écarlate")).toEqual(["#a1a1aa"]);
  });

  it("splits a compound hyphenated name into one hex per segment", () => {
    expect(getSwatchColors("Black-White")).toEqual(["#18181b", "#ffffff"]);
  });

  it("falls back to neutral for a blank name", () => {
    expect(getSwatchColors("")).toEqual(["#a1a1aa"]);
  });
});

describe("getSwatchColor", () => {
  it("returns only the first resolved color of a compound name", () => {
    expect(getSwatchColor("Red-Black-White")).toBe("#ef4444");
  });
});

describe("getSwatchStyle", () => {
  it("returns a flat backgroundColor for a single color", () => {
    expect(getSwatchStyle("Noir")).toEqual({ backgroundColor: "#18181b" });
  });

  it("returns a conic-gradient split for a compound color", () => {
    const style = getSwatchStyle("Black-White");
    expect(style.background).toContain("conic-gradient(");
    expect(style.background).toContain("#18181b 0%");
    expect(style.background).toContain("#ffffff 50%");
  });
});

describe("lookupSwatchHexes", () => {
  it("gives null instead of the neutral fallback for an unknown name", () => {
    expect(lookupSwatchHexes("Chartreuse")).toEqual([null]);
  });

  it("resolves each segment of a compound name", () => {
    expect(lookupSwatchHexes("noir - Écarlate")).toEqual(["#18181b", null]);
  });
});
