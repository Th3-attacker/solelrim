import { describe, expect, it } from "vitest";
import { getVariantStockStatus, getAggregateStockStatus } from "@/lib/shop/stock";

describe("getVariantStockStatus", () => {
  it("is out when stock is zero", () => {
    expect(getVariantStockStatus(0, 5)).toBe("out");
  });

  it("is out when stock is negative", () => {
    expect(getVariantStockStatus(-1, 5)).toBe("out");
  });

  it("is low when stock is at or under the threshold", () => {
    expect(getVariantStockStatus(5, 5)).toBe("low");
    expect(getVariantStockStatus(1, 5)).toBe("low");
  });

  it("is in when stock is above the threshold", () => {
    expect(getVariantStockStatus(6, 5)).toBe("in");
  });
});

describe("getAggregateStockStatus", () => {
  it("is out for an empty variant list", () => {
    expect(getAggregateStockStatus([])).toBe("out");
  });

  it("is out only when every variant is out", () => {
    const variants = [
      { stock: 0, lowStockThreshold: 5 },
      { stock: 0, lowStockThreshold: 5 },
    ];
    expect(getAggregateStockStatus(variants)).toBe("out");
  });

  it("is in when at least one variant is in stock, even if others are out", () => {
    const variants = [
      { stock: 0, lowStockThreshold: 5 },
      { stock: 10, lowStockThreshold: 5 },
    ];
    expect(getAggregateStockStatus(variants)).toBe("in");
  });

  it("is low when the best variant is low but none is fully in stock", () => {
    const variants = [
      { stock: 0, lowStockThreshold: 5 },
      { stock: 3, lowStockThreshold: 5 },
    ];
    expect(getAggregateStockStatus(variants)).toBe("low");
  });
});
