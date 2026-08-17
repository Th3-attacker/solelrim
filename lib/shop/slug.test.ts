import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/shop/slug";

describe("slugify", () => {
  it("lowercases and strips accents", () => {
    expect(slugify("Chemise Été")).toBe("chemise-ete");
  });

  it("collapses non-alphanumeric runs into a single hyphen", () => {
    expect(slugify("T-Shirt  Plyester!!")).toBe("t-shirt-plyester");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  --Chaussures--  ")).toBe("chaussures");
  });

  it("falls back to a default slug when nothing alphanumeric survives", () => {
    expect(slugify("!!!")).toBe("produit");
    expect(slugify("")).toBe("produit");
  });
});
