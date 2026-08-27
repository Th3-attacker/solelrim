import { describe, expect, it } from "vitest";
import {
  buildCustomThemePreset,
  contrastRatio,
  isValidHexColor,
  meetsMinimumContrast,
} from "@/lib/theme/custom-color";

describe("contrastRatio", () => {
  it("returns 21 for pure black against pure white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });

  it("returns 1 for a color against itself", () => {
    expect(contrastRatio("#3366cc", "#3366cc")).toBeCloseTo(1, 5);
  });

  it("is symmetric regardless of argument order", () => {
    expect(contrastRatio("#1e3a5f", "#ffffff")).toBeCloseTo(
      contrastRatio("#ffffff", "#1e3a5f"),
      10,
    );
  });
});

describe("meetsMinimumContrast", () => {
  it("accepts a dark, strongly saturated color (white text reads fine)", () => {
    expect(meetsMinimumContrast("#1e3a5f")).toBe(true);
  });

  it("accepts near-white and near-black extremes", () => {
    expect(meetsMinimumContrast("#fefefe")).toBe(true);
    expect(meetsMinimumContrast("#010101")).toBe(true);
  });

  it("rejects a murky mid-tone gray where neither black nor white text clears WCAG AA", () => {
    // #797979 sits right in the gap: ~4.35:1 against both white and the
    // app's near-black foreground (#111111), below the 4.5:1 AA floor.
    expect(meetsMinimumContrast("#797979")).toBe(false);
  });
});

describe("buildCustomThemePreset", () => {
  it("picks white text for a dark custom color", () => {
    const preset = buildCustomThemePreset("#1e3a5f");
    expect(preset.light.primaryForeground).toBe("#ffffff");
  });

  it("picks dark text for a light custom color", () => {
    const preset = buildCustomThemePreset("#fde68a");
    expect(preset.light.primaryForeground).toBe("#111111");
  });

  it("lightens a very dark color for the dark-mode variant", () => {
    const preset = buildCustomThemePreset("#111111");
    expect(preset.dark.primary).not.toBe("#111111");
  });

  it("keeps an already-light color unchanged for the dark-mode variant", () => {
    const preset = buildCustomThemePreset("#fde68a");
    expect(preset.dark.primary).toBe("#fde68a");
  });
});

describe("isValidHexColor", () => {
  it("accepts a well-formed 6-digit hex", () => {
    expect(isValidHexColor("#abcdef")).toBe(true);
  });

  it("rejects a 3-digit shorthand or missing hash", () => {
    expect(isValidHexColor("#abc")).toBe(false);
    expect(isValidHexColor("abcdef")).toBe(false);
  });
});
