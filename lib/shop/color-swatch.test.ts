import { describe, expect, it } from "vitest";
import { getSwatchColors, getSwatchColor, getSwatchStyle } from "@/lib/shop/color-swatch";

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
