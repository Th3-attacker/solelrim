import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/lib/generated/prisma/client";

vi.mock("@/lib/prisma", () => ({ prisma: mockDeep<PrismaClient>() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/services/orders", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/services/orders")>()),
  placeOrder: vi.fn(),
  trackOrder: vi.fn(),
}));
vi.mock("@/lib/services/promo-codes", () => ({ previewPromoCode: vi.fn() }));
vi.mock("@/lib/services/cart", () => ({ checkVariantStocks: vi.fn() }));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  RATE_LIMITS: (await importOriginal<typeof import("@/lib/rate-limit")>()).RATE_LIMITS,
  checkRateLimit: vi.fn(),
  rateLimitRetryAfter: vi.fn(),
  getClientIp: vi.fn().mockResolvedValue("1.2.3.4"),
}));
vi.mock("@/lib/queries/shop", () => ({
  getActiveProductsPage: vi.fn(),
  getFilteredProductsPage: vi.fn(),
  getCatalogueFacets: vi.fn(),
  searchActiveProducts: vi.fn(),
  getActiveProductBySlug: vi.fn(),
  getAllShopCategories: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { placeOrder, trackOrder } from "@/lib/services/orders";
import { checkRateLimit, rateLimitRetryAfter } from "@/lib/rate-limit";
import { checkVariantStocks } from "@/lib/services/cart";
import {
  getActiveProductsPage,
  getCatalogueFacets,
  getFilteredProductsPage,
  searchActiveProducts,
} from "@/lib/queries/shop";
import { POST as postOrder } from "@/app/api/v1/boutiques/[key]/orders/route";
import { POST as postTrack } from "@/app/api/v1/boutiques/[key]/orders/track/route";
import { GET as getProducts } from "@/app/api/v1/boutiques/[key]/products/route";
import { POST as postStocks } from "@/app/api/v1/boutiques/[key]/stocks/route";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const submitOrderMock = placeOrder as unknown as Mock;
const trackOrderMock = trackOrder as unknown as Mock;
const rateLimitMock = checkRateLimit as unknown as Mock;
const retryAfterMock = rateLimitRetryAfter as unknown as Mock;
const stocksMock = checkVariantStocks as unknown as Mock;

const ctx = (key: string) => ({ params: Promise.resolve({ key }) });
const open = { key: "sport", licenseStatus: "ACTIVE", licenseType: "MONTHLY", licenseExpiresAt: null };

function post(path: string, body: BodyInit, headers?: HeadersInit) {
  return new Request(`https://shop.example${path}`, { method: "POST", body, headers });
}

beforeEach(() => {
  // withApi's per-request log line.
  vi.spyOn(console, "info").mockImplementation(() => {});
  mockReset(prismaMock);
  submitOrderMock.mockReset();
  trackOrderMock.mockReset();
  rateLimitMock.mockReset().mockResolvedValue(true);
  retryAfterMock.mockReset().mockResolvedValue(null);
  stocksMock.mockReset();
  prismaMock.storeType.findUnique.mockResolvedValue(open as never);
});

describe("a closed or unknown boutique", () => {
  it("is a 404 for a key that isn't in the registry", async () => {
    prismaMock.storeType.findUnique.mockResolvedValue(null);

    const response = await postOrder(post("/x", new FormData()), ctx("nope"));

    expect(response.status).toBe(404);
    expect(submitOrderMock).not.toHaveBeenCalled();
  });

  it("is a 403 once its license is suspended", async () => {
    prismaMock.storeType.findUnique.mockResolvedValue({ ...open, licenseStatus: "SUSPENDED" } as never);

    const response = await postOrder(post("/x", new FormData()), ctx("sport"));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "storefrontExpired" });
  });
});

describe("POST orders", () => {
  it("places the order for the boutique in the URL, whatever the body says", async () => {
    submitOrderMock.mockResolvedValue({ reference: "CMD-1", orderId: "o1" });
    const form = new FormData();
    form.set("productType", "cosmetique"); // a lie
    form.set("customerName", "Aïcha");

    const response = await postOrder(post("/x", form), ctx("sport"));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ reference: "CMD-1", orderId: "o1" });
    const sent = submitOrderMock.mock.calls[0][0];
    expect(sent.productType).toBe("sport");
    expect(sent.customerName).toBe("Aïcha");
  });

  it("turns the action's error codes into HTTP statuses", async () => {
    submitOrderMock.mockResolvedValue({ error: "rateLimited" });
    expect((await postOrder(post("/x", new FormData()), ctx("sport"))).status).toBe(429);

    submitOrderMock.mockResolvedValue({ error: "insufficientStock" });
    expect((await postOrder(post("/x", new FormData()), ctx("sport"))).status).toBe(409);

    submitOrderMock.mockResolvedValue({ error: "transactionAlreadyUsed" });
    const reused = await postOrder(post("/x", new FormData()), ctx("sport"));
    expect(reused.status).toBe(409);
    expect(await reused.json()).toEqual({ error: "transactionAlreadyUsed" });
  });

  it("sends Retry-After with a 429", async () => {
    submitOrderMock.mockResolvedValue({ error: "rateLimited", retryAfter: 120 });

    const response = await postOrder(post("/x", new FormData()), ctx("sport"));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("120");
    expect(await response.json()).toEqual({ error: "rateLimited" });
  });

  it("refuses a body that isn't a form", async () => {
    const response = await postOrder(post("/x", "not a form", { "content-type": "text/plain" }), ctx("sport"));

    expect(response.status).toBe(400);
  });
});

describe("POST orders with an Idempotency-Key", () => {
  const withKey = (key: string) => post("/x", new FormData(), { "Idempotency-Key": key });

  it("passes the key to the order and answers 201 the first time", async () => {
    submitOrderMock.mockResolvedValue({ reference: "CMD-1", orderId: "o1" });

    const response = await postOrder(withKey("k-1"), ctx("sport"));

    expect(response.status).toBe(201);
    expect(submitOrderMock.mock.calls[0][1]).toEqual({ idempotencyKey: "k-1" });
  });

  it("answers a resend with the order submitOrder found for the key", async () => {
    // The lookup itself is submitOrder's (lib/actions/orders.test.ts).
    submitOrderMock.mockResolvedValue({ reference: "CMD-1", orderId: "o1" });

    const response = await postOrder(withKey("k-1"), ctx("sport"));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ reference: "CMD-1", orderId: "o1" });
    expect(submitOrderMock.mock.calls[0][0].productType).toBe("sport");
  });

  it("refuses a key longer than 64 characters", async () => {
    const response = await postOrder(withKey("x".repeat(65)), ctx("sport"));

    expect(response.status).toBe(400);
    expect(submitOrderMock).not.toHaveBeenCalled();
  });

  it("keeps the old behaviour without the header", async () => {
    submitOrderMock.mockResolvedValue({ error: "insufficientStock" });

    const response = await postOrder(post("/x", new FormData()), ctx("sport"));

    expect(response.status).toBe(409);
    expect(submitOrderMock.mock.calls[0][1]).toEqual({ idempotencyKey: undefined });
  });
});

describe("POST orders/track", () => {
  it("looks the order up in the boutique of the URL", async () => {
    trackOrderMock.mockResolvedValue({ reference: "CMD-1", status: "PENDING" });

    const response = await postTrack(
      post("/x", JSON.stringify({ phone: "37737353", reference: "CMD-1", productType: "cosmetique" }), {
        "content-type": "application/json",
      }),
      ctx("sport"),
    );

    expect(response.status).toBe(200);
    expect(trackOrderMock).toHaveBeenCalledWith(expect.objectContaining({ productType: "sport" }));
  });

  it("is a 404 when no order matches", async () => {
    trackOrderMock.mockResolvedValue({ error: "notFound" });

    const response = await postTrack(post("/x", "{}"), ctx("sport"));

    expect(response.status).toBe(404);
  });
});

describe("GET products", () => {
  it("returns one page of the catalogue with its total", async () => {
    (getActiveProductsPage as unknown as Mock).mockResolvedValue({ items: [], total: 42 });

    const response = await getProducts(
      new Request("https://shop.example/x?page=2&pageSize=10"),
      ctx("sport"),
    );

    expect(await response.json()).toEqual({ products: [], page: 2, pageSize: 10, total: 42 });
    expect(getActiveProductsPage).toHaveBeenCalledWith("sport", { categoryId: undefined, page: 2, pageSize: 10 });
  });

  it("rate-limits the search, saying when to retry", async () => {
    retryAfterMock.mockResolvedValue(120);

    const response = await getProducts(new Request("https://shop.example/x?q=tshirt"), ctx("sport"));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("120");
    expect(searchActiveProducts).not.toHaveBeenCalled();
  });
});

describe("POST stocks", () => {
  const body = (variantIds: unknown) => post("/x", JSON.stringify({ variantIds }));

  it("returns the stock map", async () => {
    stocksMock.mockResolvedValue({ stocks: { v1: 3 } });

    const response = await postStocks(body(["v1"]), ctx("sport"));

    expect(await response.json()).toEqual({ stocks: { v1: 3 } });
  });

  it("is a 400, not a 429, for a malformed list", async () => {
    stocksMock.mockResolvedValue({ error: "invalid" });

    const response = await postStocks(body(Array(51).fill("v1")), ctx("sport"));

    expect(response.status).toBe(400);
  });

  it("is a 429 with Retry-After when rate-limited", async () => {
    stocksMock.mockResolvedValue({ error: "rateLimited", retryAfter: 300 });

    const response = await postStocks(body(["v1"]), ctx("sport"));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("300");
  });
});

describe("GET products with sort and filters", () => {
  const filteredMock = getFilteredProductsPage as unknown as Mock;
  const facetsMock = getCatalogueFacets as unknown as Mock;
  const list = (query: string) => getProducts(new Request(`https://shop.example/x?${query}`), ctx("sport"));

  beforeEach(() => {
    filteredMock.mockReset().mockResolvedValue({ items: [], total: 6 });
    facetsMock.mockReset();
    (getActiveProductsPage as unknown as Mock).mockReset().mockResolvedValue({ items: [], total: 42 });
    (searchActiveProducts as unknown as Mock).mockReset().mockResolvedValue([]);
  });

  it("answers exactly as before without any of the new parameters", async () => {
    const response = await list("category=c1&page=2&pageSize=10");

    expect(await response.json()).toEqual({ products: [], page: 2, pageSize: 10, total: 42 });
    expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=30, stale-while-revalidate=60");
    expect(filteredMock).not.toHaveBeenCalled();
  });

  it("keeps the search as one capped page without the new parameters", async () => {
    await list("q=tshirt");

    expect(searchActiveProducts).toHaveBeenCalled();
    expect(filteredMock).not.toHaveBeenCalled();
  });

  it("passes every parameter to the filtered query, with the real total", async () => {
    const response = await list(
      "category=c1&sort=price_asc&sizes=M,L&colors=Noir,Noir-Blanc&priceMin=1000&priceMax=2000&page=2&pageSize=5",
    );

    expect(filteredMock).toHaveBeenCalledWith(
      {
        productType: "sport",
        categoryId: "c1",
        query: undefined,
        sort: "price_asc",
        sizes: ["M", "L"],
        colors: ["Noir", "Noir-Blanc"],
        priceMin: 1000,
        priceMax: 2000,
      },
      { page: 2, pageSize: 5 },
    );
    expect(await response.json()).toEqual({ products: [], page: 2, pageSize: 5, total: 6 });
    expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=30, stale-while-revalidate=60");
    expect(facetsMock).not.toHaveBeenCalled();
  });

  it("defaults the sort to popular and decodes color names", async () => {
    await list("colors=Noir%2CBleu%20marine");

    expect(filteredMock).toHaveBeenCalledWith(
      expect.objectContaining({ sort: "popular", colors: ["Noir", "Bleu marine"] }),
      expect.anything(),
    );
  });

  it("paginates a filtered search, still rate-limited and not cached", async () => {
    const response = await list("q=tshirt&sizes=M&page=2");

    expect(filteredMock).toHaveBeenCalledWith(expect.objectContaining({ query: "tshirt" }), { page: 2, pageSize: 20 });
    expect(retryAfterMock).toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("adds the facets with facets=1, with the colors' swatches", async () => {
    facetsMock.mockResolvedValue({
      sizes: [{ value: "M", count: 6 }, { value: "XL", count: 0 }],
      colors: [{ value: "Noir-Blanc", count: 2 }],
      price: { min: 150, max: 2850 },
    });

    const body = await (await list("facets=1")).json();

    expect(body.facets).toEqual({
      sizes: [{ value: "M", count: 6 }, { value: "XL", count: 0 }],
      colors: [{ name: "Noir-Blanc", hex: "#18181b", hexes: ["#18181b", "#ffffff"], count: 2 }],
      price: { min: 150, max: 2850 },
    });
  });

  it.each([
    "sort=cheapest",
    "priceMin=-1",
    "priceMin=10.5",
    "priceMax=abc",
    "priceMin=2000&priceMax=1000",
    `sizes=${Array.from({ length: 21 }, (_, i) => `S${i}`).join(",")}`,
    `colors=${Array.from({ length: 21 }, (_, i) => `C${i}`).join(",")}`,
    "facets=true",
  ])("refuses %s with 400 invalid", async (query) => {
    const response = await list(query);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid" });
    expect(filteredMock).not.toHaveBeenCalled();
  });
});
