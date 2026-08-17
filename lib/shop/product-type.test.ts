import { describe, expect, it } from "vitest";
import { isProductType, PRODUCT_TYPES, RESERVED_STORE_TYPE_KEYS } from "@/lib/shop/product-type";

describe("isProductType", () => {
  it("is true for a built-in preset", () => {
    expect(isProductType("sport")).toBe(true);
    expect(isProductType("cosmetique")).toBe(true);
  });

  it("is false for a custom store type — it's a preset check, not a validity check", () => {
    expect(isProductType("bijouterie")).toBe(false);
  });

  it("matches every entry declared in PRODUCT_TYPES", () => {
    for (const type of PRODUCT_TYPES) {
      expect(isProductType(type)).toBe(true);
    }
  });
});

describe("RESERVED_STORE_TYPE_KEYS", () => {
  it("reserves the admin key so a boutique can never claim it", () => {
    expect(RESERVED_STORE_TYPE_KEYS.has("admin")).toBe(true);
  });
});
