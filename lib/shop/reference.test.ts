import { describe, expect, it } from "vitest";
import { buildOrderReference, buildSaleReference } from "@/lib/shop/reference";

describe("buildOrderReference", () => {
  it("is CMD- and 8 characters with no 0/O or 1/I", () => {
    for (let i = 0; i < 200; i++) {
      expect(buildOrderReference()).toMatch(/^CMD-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
    }
  });

  it("doesn't repeat itself", () => {
    const references = new Set(Array.from({ length: 1000 }, buildOrderReference));
    expect(references.size).toBe(1000);
  });
});

describe("buildSaleReference", () => {
  it("keeps the in-store INV-date-number format", () => {
    expect(buildSaleReference()).toMatch(/^INV-\d{8}-\d{4}$/);
  });
});
