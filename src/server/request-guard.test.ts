import { describe, expect, it } from "vitest";
import { isCrossSiteWrite } from "./request-guard";

describe("isCrossSiteWrite", () => {
  const host = "solal-rim.com";

  it("lets reads through, whoever sends them", () => {
    expect(isCrossSiteWrite({ method: "GET", origin: "https://evil.example", host })).toBe(false);
    expect(isCrossSiteWrite({ method: "HEAD", origin: "https://evil.example", host })).toBe(false);
  });

  it("lets a write from the app's own pages through", () => {
    expect(isCrossSiteWrite({ method: "POST", origin: "https://solal-rim.com", host })).toBe(false);
    expect(
      isCrossSiteWrite({ method: "POST", origin: "http://localhost:3001", host: "localhost:3001" }),
    ).toBe(false);
  });

  it("refuses a write from another site or a sibling subdomain", () => {
    expect(isCrossSiteWrite({ method: "POST", origin: "https://evil.example", host })).toBe(true);
    expect(isCrossSiteWrite({ method: "DELETE", origin: "https://shop.solal-rim.com", host })).toBe(
      true,
    );
  });

  it("refuses an opaque or malformed origin", () => {
    expect(isCrossSiteWrite({ method: "POST", origin: "null", host })).toBe(true);
  });

  it("lets a write without Origin through (mobile app, server to server)", () => {
    expect(isCrossSiteWrite({ method: "POST", origin: null, host })).toBe(false);
  });
});
