import { describe, expect, it } from "vitest";
import { getVariantPrice, getPriceRange } from "@/lib/shop/price";

// Prisma Decimal fields only need `.toNumber()` for this module's purposes
// (same convention as lib/actions/orders.test.ts).
function decimal(value: number) {
  return { toNumber: () => value };
}

describe("getVariantPrice", () => {
  it("uses the variant's own price when set", () => {
    expect(getVariantPrice({ price: decimal(1500) as never }, decimal(1000) as never)).toBe(1500);
  });

  it("falls back to the product's base price when the variant has none", () => {
    expect(getVariantPrice({ price: null }, decimal(1000) as never)).toBe(1000);
  });
});

describe("getPriceRange", () => {
  it("reports isRange: false when every variant resolves to the same price", () => {
    const variants = [{ price: null }, { price: null }];
    expect(getPriceRange(variants, decimal(1000) as never)).toEqual({
      min: 1000,
      max: 1000,
      isRange: false,
    });
  });

  it("reports the min/max across variants with different prices", () => {
    const variants = [{ price: decimal(1200) as never }, { price: null }, { price: decimal(900) as never }];
    expect(getPriceRange(variants, decimal(1000) as never)).toEqual({
      min: 900,
      max: 1200,
      isRange: true,
    });
  });

  it("collapses to a single value for one variant", () => {
    const variants = [{ price: decimal(2500) as never }];
    expect(getPriceRange(variants, decimal(1000) as never)).toEqual({
      min: 2500,
      max: 2500,
      isRange: false,
    });
  });
});
