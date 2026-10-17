import { describe, expect, it } from "vitest";
import { getDirection, isLocale, pickLocale } from "./config";

describe("pickLocale", () => {
  it("keeps the language the visitor picked before", () => {
    expect(pickLocale({ cookie: "ar", acceptLanguage: "en-US,en;q=0.9" })).toBe("ar");
  });

  it("ignores a cookie naming a language the app doesn't speak", () => {
    expect(pickLocale({ cookie: "de", acceptLanguage: "en-GB" })).toBe("en");
  });

  it("takes the browser's best-ranked language the app speaks", () => {
    expect(pickLocale({ acceptLanguage: "de-DE,ar;q=0.8,en;q=0.9" })).toBe("en");
  });

  it("keeps the browser's order between equal weights", () => {
    expect(pickLocale({ acceptLanguage: "ar-MR, fr-FR" })).toBe("ar");
  });

  it("skips languages refused with q=0", () => {
    expect(pickLocale({ acceptLanguage: "en;q=0, ar;q=0.5" })).toBe("ar");
  });

  it("falls back to French", () => {
    expect(pickLocale({})).toBe("fr");
    expect(pickLocale({ acceptLanguage: "de, es;q=0.5" })).toBe("fr");
    expect(pickLocale({ acceptLanguage: "garbage;;;" })).toBe("fr");
  });
});

describe("isLocale / getDirection", () => {
  it("knows the three languages and only them", () => {
    expect(["fr", "en", "ar"].every(isLocale)).toBe(true);
    expect(isLocale("admin")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it("lays Arabic out right to left", () => {
    expect(getDirection("ar")).toBe("rtl");
    expect(getDirection("fr")).toBe("ltr");
  });
});
