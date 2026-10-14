import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import type { Prisma } from "@/lib/generated/prisma/client";
import {
  catalogueCountSql,
  catalogueIdsSql,
  colorFacetSql,
  priceFacetSql,
  sizeFacetSql,
  type CatalogueFilters,
} from "@/lib/queries/catalogue-filters";
import { sortBySize } from "@/lib/shop/size-order";

// The filters are SQL, so they are tested on a real (in-memory) Postgres with
// the columns they read, not on mocks.
let db: PGlite;

const run = async <T>(sql: Prisma.Sql) => (await db.query<T>(sql.text, sql.values)).rows;

// p1 T-shirt     base 1000, Jan 1, cat c1: S Noir 1000 (2) · M Noir 1200 (0) · M Blanc base (3)
// p2 Pantalon    base 2500, Jan 2, cat c1, featured: M Noir base (1) · L Noir 3000 (1)
// p3 Chaussures  base 800,  Jan 3, cat c2: 42 Noir-Blanc base (5) · 40,5 Noir-Blanc base (0)
// p4 Écharpe     base 500,  Jan 3 (same instant as p3), cat c1: TU Rouge base (0)
// p7 Cadeau      base 1500, Dec 31, cat c1: no variants
// p5 hidden (inactive), p6 in another boutique: never listed.
// Booting the in-memory Postgres (WASM) takes a few seconds, more on a busy
// machine running the whole suite in parallel: past the default 10 s.
beforeAll(async () => {
  db = new PGlite({ extensions: { unaccent } });
  await db.exec(`
    CREATE EXTENSION unaccent;
    CREATE TABLE "Product" (
      "id" text PRIMARY KEY, "name" text NOT NULL, "basePrice" numeric(10,2) NOT NULL,
      "isFeatured" boolean NOT NULL DEFAULT false, "categoryId" text NOT NULL,
      "productType" text NOT NULL, "isActive" boolean NOT NULL DEFAULT true,
      "createdAt" timestamp(3) NOT NULL
    );
    CREATE TABLE "ProductVariant" (
      "id" text PRIMARY KEY, "productId" text NOT NULL REFERENCES "Product"("id"),
      "size" text NOT NULL, "color" text NOT NULL, "price" numeric(10,2),
      "stock" integer NOT NULL, "createdAt" timestamp(3) NOT NULL
    );
    INSERT INTO "Product" VALUES
      ('p1', 'T-shirt',    1000, false, 'c1', 'sport', true,  '2026-01-01'),
      ('p2', 'Pantalon',   2500, true,  'c1', 'sport', true,  '2026-01-02'),
      ('p3', 'Chaussures', 800,  false, 'c2', 'sport', true,  '2026-01-03'),
      ('p4', 'Écharpe',    500,  false, 'c1', 'sport', true,  '2026-01-03'),
      ('p5', 'Caché',      100,  false, 'c1', 'sport', false, '2026-01-04'),
      ('p6', 'Autre',      100,  false, 'c1', 'mode',  true,  '2026-01-04'),
      ('p7', 'Cadeau',     1500, false, 'c1', 'sport', true,  '2025-12-31');
    INSERT INTO "ProductVariant" VALUES
      ('v1', 'p1', 'S',    'Noir',       1000, 2, '2026-01-01 00:00:01'),
      ('v2', 'p1', 'M',    'Noir',       1200, 0, '2026-01-01 00:00:02'),
      ('v3', 'p1', 'M',    'Blanc',      NULL, 3, '2026-01-01 00:00:03'),
      ('v4', 'p2', 'M',    'Noir',       NULL, 1, '2026-01-02 00:00:01'),
      ('v5', 'p2', 'L',    'Noir',       3000, 1, '2026-01-02 00:00:02'),
      ('v6', 'p3', '42',   'Noir-Blanc', NULL, 5, '2026-01-03 00:00:01'),
      ('v7', 'p3', '40,5', 'Noir-Blanc', NULL, 0, '2026-01-03 00:00:02'),
      ('v8', 'p4', 'TU',   'Rouge',      NULL, 0, '2026-01-03 00:00:03'),
      ('v9', 'p5', 'S',    'Noir',       NULL, 9, '2026-01-04 00:00:01'),
      ('v10','p6', 'S',    'Noir',       NULL, 9, '2026-01-04 00:00:01');
  `);
}, 30_000);

afterAll(async () => {
  await db.close();
});

const filters = (overrides: Partial<CatalogueFilters> = {}): CatalogueFilters => ({
  productType: "sport",
  sort: "popular",
  sizes: [],
  colors: [],
  ...overrides,
});

async function ids(overrides: Partial<CatalogueFilters> = {}, page = 1, pageSize = 50) {
  return (await run<{ id: string }>(catalogueIdsSql(filters(overrides), page, pageSize))).map(
    (row) => row.id,
  );
}

async function total(overrides: Partial<CatalogueFilters> = {}) {
  return (await run<{ total: number }>(catalogueCountSql(filters(overrides))))[0].total;
}

describe("sort", () => {
  it("popular: featured first, then the catalogue's order (newest, then id)", async () => {
    expect(await ids()).toEqual(["p2", "p4", "p3", "p1", "p7"]);
  });

  it("newest: creation date, newest first, then id", async () => {
    expect(await ids({ sort: "newest" })).toEqual(["p4", "p3", "p2", "p1", "p7"]);
  });

  it("price_asc: price.min over every variant (base price without variants)", async () => {
    // p4 500 · p3 800 · p1 1000 · p7 1500 · p2 2500
    expect(await ids({ sort: "price_asc" })).toEqual(["p4", "p3", "p1", "p7", "p2"]);
  });

  it("price_desc: price.max over every variant", async () => {
    // p2 3000 · p7 1500 · p1 1200 · p3 800 · p4 500
    expect(await ids({ sort: "price_desc" })).toEqual(["p2", "p7", "p1", "p3", "p4"]);
  });

  it.each(["popular", "price_asc", "price_desc", "newest"] as const)(
    "%s: pages of 2 neither repeat nor skip a product",
    async (sort) => {
      const all = await ids({ sort });
      const paged = [
        ...(await ids({ sort }, 1, 2)),
        ...(await ids({ sort }, 2, 2)),
        ...(await ids({ sort }, 3, 2)),
      ];
      expect(paged).toEqual(all);
    },
  );
});

describe("filters", () => {
  it("sizes: a variant in stock in one of the sizes", async () => {
    // p1's M Blanc and p2's M Noir are in stock.
    expect(await ids({ sizes: ["M"] })).toEqual(["p2", "p1"]);
    expect(await ids({ sizes: ["S", "42"] })).toEqual(["p3", "p1"]);
  });

  it("colors: a variant in stock in one of the colors, exact names", async () => {
    expect(await ids({ colors: ["Noir-Blanc"] })).toEqual(["p3"]);
    expect(await ids({ colors: ["noir"] })).toEqual([]);
    // p4's only Rouge variant is sold out.
    expect(await ids({ colors: ["Rouge"] })).toEqual([]);
  });

  it("size and color must be on the same variant", async () => {
    // p1 has a black S and a white M in stock, but its black M is sold out.
    expect(await ids({ sizes: ["M"], colors: ["Noir"] })).toEqual(["p2"]);
  });

  it("price: the app's three ranges, on the variant's price (else the base price)", async () => {
    expect(await ids({ priceMax: 999 })).toEqual(["p3"]);
    expect(await ids({ priceMin: 1000, priceMax: 2000 })).toEqual(["p1"]);
    expect(await ids({ priceMin: 2001 })).toEqual(["p2"]);
  });

  it("price applies to the same variant as size and color", async () => {
    // p2's black M is 2500, its 3000 is an L.
    expect(await ids({ sizes: ["M"], priceMin: 2600 })).toEqual([]);
    expect(await ids({ sizes: ["L"], priceMin: 2600 })).toEqual(["p2"]);
  });

  it("combines with category and an accent-insensitive search", async () => {
    expect(await ids({ categoryId: "c1", sizes: ["S", "42"] })).toEqual(["p1"]);
    // Without a variant filter, a sold-out product is still listed, as before.
    expect(await ids({ query: "echarpe" })).toEqual(["p4"]);
    expect(await ids({ query: "t-shirt", colors: ["Blanc"] })).toEqual(["p1"]);
  });

  it("an unknown size or color gives nothing, not an error", async () => {
    expect(await ids({ sizes: ["XXXXL"] })).toEqual([]);
    expect(await total({ sizes: ["XXXXL"] })).toBe(0);
  });

  it("never lists an inactive product or another boutique's", async () => {
    expect(await ids({ sizes: ["S"] })).toEqual(["p1"]);
  });

  it("total counts the filtered products, whatever the page", async () => {
    expect(await total()).toBe(5);
    expect(await total({ sizes: ["M"] })).toBe(2);
    expect(await total({ sizes: ["M"], colors: ["Noir"] })).toBe(1);
  });
});

describe("facets", () => {
  async function sizes(overrides: Partial<CatalogueFilters> = {}) {
    const rows = await run<{ value: string; count: number }>(sizeFacetSql(filters(overrides)));
    return sortBySize(rows, (row) => row.value).map((row) => `${row.value}:${row.count}`);
  }
  async function colors(overrides: Partial<CatalogueFilters> = {}) {
    const rows = await run<{ value: string; count: number }>(colorFacetSql(filters(overrides)));
    return rows.map((row) => `${row.value}:${row.count}`);
  }
  async function price(overrides: Partial<CatalogueFilters> = {}) {
    return (
      await run<{ min: number | null; max: number | null }>(priceFacetSql(filters(overrides)))
    )[0];
  }

  it("lists every size of the scope, sold out at 0, in size order", async () => {
    expect(await sizes()).toEqual(["S:1", "M:2", "L:1", "40,5:0", "42:1", "TU:0"]);
  });

  it("a filter doesn't change its own counts, the others do", async () => {
    expect(await sizes({ sizes: ["S"] })).toEqual(await sizes());
    // Black only: p1's M is sold out in black, p3 is Noir-Blanc.
    expect(await sizes({ colors: ["Noir"] })).toEqual([
      "S:1",
      "M:1",
      "L:1",
      "40,5:0",
      "42:0",
      "TU:0",
    ]);
  });

  it("lists the colors in entry order with their counts", async () => {
    expect(await colors()).toEqual(["Noir:2", "Blanc:1", "Noir-Blanc:1", "Rouge:0"]);
    expect(await colors({ colors: ["Rouge"] })).toEqual(await colors());
    expect(await colors({ sizes: ["M"] })).toEqual([
      "Noir:1",
      "Blanc:1",
      "Noir-Blanc:0",
      "Rouge:0",
    ]);
  });

  it("stays within the category and the search", async () => {
    expect(await sizes({ categoryId: "c2" })).toEqual(["40,5:0", "42:1"]);
    expect(await colors({ query: "pantalon" })).toEqual(["Noir:1"]);
  });

  it("price: the extremes in stock, ignoring the price filter", async () => {
    expect(await price()).toEqual({ min: 800, max: 3000 });
    expect(await price({ priceMax: 999 })).toEqual({ min: 800, max: 3000 });
    expect(await price({ colors: ["Blanc"] })).toEqual({ min: 1000, max: 1000 });
    expect(await price({ colors: ["Rouge"] })).toEqual({ min: null, max: null });
  });
});
