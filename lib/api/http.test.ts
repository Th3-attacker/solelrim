import { describe, expect, it } from "vitest";
import { failFromCode, localeOf, pageOf } from "@/lib/api/http";

describe("failFromCode", () => {
  it.each([
    ["invalid", 400],
    ["rateLimited", 429],
    ["notFound", 404],
    ["storefrontExpired", 403],
    ["insufficientStock", 409],
    ["fileTooLarge", 413],
  ])("answers %s with %i", async (code, status) => {
    const response = failFromCode(code);
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: code });
  });

  it("answers an unknown business error with 422, never 200 or 500", () => {
    expect(failFromCode("somethingNew").status).toBe(422);
  });
});

describe("localeOf", () => {
  it("accepts the supported locales and falls back to French", () => {
    expect(localeOf(new URL("https://x/api?locale=ar"))).toBe("ar");
    expect(localeOf(new URL("https://x/api?locale=en"))).toBe("en");
    expect(localeOf(new URL("https://x/api?locale=de"))).toBe("fr");
    expect(localeOf(new URL("https://x/api"))).toBe("fr");
  });
});

describe("pageOf", () => {
  it("defaults to the first page of 20", () => {
    expect(pageOf(new URL("https://x/api"))).toEqual({ page: 1, pageSize: 20 });
  });

  it("caps the page size and ignores nonsense", () => {
    expect(pageOf(new URL("https://x/api?page=3&pageSize=500"))).toEqual({ page: 3, pageSize: 50 });
    expect(pageOf(new URL("https://x/api?page=-4&pageSize=abc"))).toEqual({ page: 1, pageSize: 20 });
  });
});
