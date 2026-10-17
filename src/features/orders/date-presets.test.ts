import { describe, expect, it } from "vitest";
import { matchPreset, presetRange } from "./date-presets";

const now = new Date("2026-10-14T09:30:00Z");

describe("presetRange", () => {
  it("covers whole days, today included", () => {
    expect(presetRange("today", now)).toEqual({ from: "2026-10-14", to: "2026-10-14" });
    expect(presetRange("yesterday", now)).toEqual({ from: "2026-10-13", to: "2026-10-13" });
    expect(presetRange("last7Days", now)).toEqual({ from: "2026-10-08", to: "2026-10-14" });
    expect(presetRange("last15Days", now)).toEqual({ from: "2026-09-30", to: "2026-10-14" });
  });
});

describe("matchPreset", () => {
  it("recognizes a preset's range, and nothing else", () => {
    expect(matchPreset({ from: "2026-10-08", to: "2026-10-14" }, now)).toBe("last7Days");
    expect(matchPreset({ from: "2026-10-01", to: "2026-10-03" }, now)).toBeNull();
    expect(matchPreset({}, now)).toBeNull();
  });
});
