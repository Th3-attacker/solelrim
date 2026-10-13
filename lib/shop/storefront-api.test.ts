import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchProductSuggestions, fetchVariantStocks } from "@/lib/shop/storefront-api";

afterEach(() => vi.unstubAllGlobals());

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" }, ...init });

describe("fetchProductSuggestions", () => {
  it("asks the catalogue's search for a capped page and keeps what the box shows", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      json({
        products: [
          {
            id: "p1",
            slug: "t",
            name: "T-shirt",
            imageUrl: null,
            price: { min: 900, max: 1200 },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchProductSuggestions("sport", "tee", 6);

    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/boutiques/sport/products?q=tee&pageSize=6");
    expect(result).toEqual({
      products: [{ id: "p1", slug: "t", name: "T-shirt", imageUrl: null, price: 900 }],
    });
  });

  it("tells a rate limit apart from a failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          json({ error: "rateLimited" }, { status: 429, headers: { "Retry-After": "30" } }),
        ),
    );
    expect(await fetchProductSuggestions("sport", "tee", 6)).toEqual({
      error: "rateLimited",
      retryAfter: 30,
    });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    expect(await fetchProductSuggestions("sport", "tee", 6)).toEqual({ error: "failed" });
  });
});

describe("fetchVariantStocks", () => {
  it("returns the stock map", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ stocks: { v1: 3 } })));
    expect(await fetchVariantStocks("sport", ["v1"])).toEqual({ v1: 3 });
  });

  it("returns null, never an empty map, when the check didn't happen", async () => {
    // The cart drops every variant missing from a map: {} would empty it.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json({ error: "rateLimited" }, { status: 429 })),
    );
    expect(await fetchVariantStocks("sport", ["v1"])).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    expect(await fetchVariantStocks("sport", ["v1"])).toBeNull();
  });
});
