import { describe, expect, it } from "vitest";
import { catalogueFiltersFromSearch } from "@/lib/shop/filters";

describe("catalogueFiltersFromSearch", () => {
  it("keeps the catalogue order without any filter", () => {
    expect(catalogueFiltersFromSearch("sport", {})).toEqual({
      productType: "sport",
      categoryId: undefined,
      query: undefined,
      sort: "newest",
      sizes: [],
      colors: [],
      priceMin: undefined,
      priceMax: undefined,
    });
  });

  it("speaks the API's sort names", () => {
    expect(catalogueFiltersFromSearch("sport", { sort: "price-asc" }).sort).toBe("price_asc");
    expect(catalogueFiltersFromSearch("sport", { sort: "price-desc" }).sort).toBe("price_desc");
    expect(catalogueFiltersFromSearch("sport", { sort: "newest" }).sort).toBe("newest");
    expect(catalogueFiltersFromSearch("sport", { sort: "bogus" }).sort).toBe("newest");
  });

  it("turns a price bucket into a range whose top belongs to the next bucket", () => {
    expect(catalogueFiltersFromSearch("sport", { price: "50-100" })).toMatchObject({
      priceMin: 50,
      priceMax: 99.99,
    });
    expect(catalogueFiltersFromSearch("sport", { price: "2000+" })).toMatchObject({
      priceMin: 2000,
      priceMax: undefined,
    });
    expect(catalogueFiltersFromSearch("sport", { price: "nope" })).toMatchObject({
      priceMin: undefined,
      priceMax: undefined,
    });
  });

  it("passes the category, the color and a trimmed search", () => {
    expect(
      catalogueFiltersFromSearch("sport", { category: "c1", color: "Noir", q: "  maillot " }),
    ).toMatchObject({ categoryId: "c1", colors: ["Noir"], query: "maillot" });
    expect(catalogueFiltersFromSearch("sport", { q: "   " }).query).toBeUndefined();
  });
});
