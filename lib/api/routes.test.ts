import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/lib/generated/prisma/client";

vi.mock("@/lib/prisma", () => ({ prisma: mockDeep<PrismaClient>() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/actions/orders", () => ({ submitOrder: vi.fn(), trackOrder: vi.fn() }));
vi.mock("@/lib/actions/promo-codes", () => ({ previewPromoCode: vi.fn() }));
vi.mock("@/lib/queries/orders", () => ({ findOrderByIdempotencyKey: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn().mockResolvedValue("1.2.3.4"),
}));
vi.mock("@/lib/queries/shop", () => ({
  getActiveProductsPage: vi.fn(),
  searchActiveProducts: vi.fn(),
  getActiveProductBySlug: vi.fn(),
  getAllShopCategories: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { submitOrder, trackOrder } from "@/lib/actions/orders";
import { checkRateLimit } from "@/lib/rate-limit";
import { findOrderByIdempotencyKey } from "@/lib/queries/orders";
import { getActiveProductsPage, searchActiveProducts } from "@/lib/queries/shop";
import { POST as postOrder } from "@/app/api/v1/boutiques/[key]/orders/route";
import { POST as postTrack } from "@/app/api/v1/boutiques/[key]/orders/track/route";
import { GET as getProducts } from "@/app/api/v1/boutiques/[key]/products/route";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const submitOrderMock = submitOrder as unknown as Mock;
const trackOrderMock = trackOrder as unknown as Mock;
const rateLimitMock = checkRateLimit as unknown as Mock;
const findByKeyMock = findOrderByIdempotencyKey as unknown as Mock;

const ctx = (key: string) => ({ params: Promise.resolve({ key }) });
const open = { key: "sport", licenseStatus: "ACTIVE", licenseType: "MONTHLY", licenseExpiresAt: null };

function post(path: string, body: BodyInit, headers?: HeadersInit) {
  return new Request(`https://shop.example${path}`, { method: "POST", body, headers });
}

beforeEach(() => {
  mockReset(prismaMock);
  submitOrderMock.mockReset();
  trackOrderMock.mockReset();
  rateLimitMock.mockReset().mockResolvedValue(true);
  findByKeyMock.mockReset().mockResolvedValue(null);
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
    const sent = submitOrderMock.mock.calls[0][0] as FormData;
    expect(sent.get("productType")).toBe("sport");
    expect(sent.get("customerName")).toBe("Aïcha");
  });

  it("turns the action's error codes into HTTP statuses", async () => {
    submitOrderMock.mockResolvedValue({ error: "rateLimited" });
    expect((await postOrder(post("/x", new FormData()), ctx("sport"))).status).toBe(429);

    submitOrderMock.mockResolvedValue({ error: "insufficientStock" });
    expect((await postOrder(post("/x", new FormData()), ctx("sport"))).status).toBe(409);
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

  it("answers a resend after success with the same order, without placing another", async () => {
    findByKeyMock.mockResolvedValue({ reference: "CMD-1", orderId: "o1" });

    const response = await postOrder(withKey("k-1"), ctx("sport"));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ reference: "CMD-1", orderId: "o1" });
    expect(findByKeyMock).toHaveBeenCalledWith("sport", "k-1");
    expect(submitOrderMock).not.toHaveBeenCalled();
  });

  it("gives the losing one of two concurrent sends the winner's order", async () => {
    // The winner took the last unit while this one was on its way.
    findByKeyMock.mockResolvedValueOnce(null).mockResolvedValueOnce({ reference: "CMD-1", orderId: "o1" });
    submitOrderMock.mockResolvedValue({ error: "insufficientStock" });

    const response = await postOrder(withKey("k-1"), ctx("sport"));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ reference: "CMD-1", orderId: "o1" });
  });

  it("looks the key up only in the boutique of the URL", async () => {
    // The same key was already used in "sport"; here it's a new order.
    prismaMock.storeType.findUnique.mockResolvedValue({ ...open, key: "cosmetique" } as never);
    submitOrderMock.mockResolvedValue({ reference: "CMD-2", orderId: "o2" });

    const response = await postOrder(withKey("k-1"), ctx("cosmetique"));

    expect(response.status).toBe(201);
    expect(findByKeyMock).toHaveBeenCalledWith("cosmetique", "k-1");
    expect(submitOrderMock).toHaveBeenCalled();
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
    expect(findByKeyMock).not.toHaveBeenCalled();
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

  it("rate-limits the search", async () => {
    rateLimitMock.mockResolvedValue(false);

    const response = await getProducts(new Request("https://shop.example/x?q=tshirt"), ctx("sport"));

    expect(response.status).toBe(429);
    expect(searchActiveProducts).not.toHaveBeenCalled();
  });
});
