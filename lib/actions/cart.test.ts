import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/lib/generated/prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));
vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getVariantStocks, resolveSharedCartLines } from "@/lib/actions/cart";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const headersMock = headers as unknown as Mock;

beforeEach(() => {
  mockReset(prismaMock);
  headersMock.mockResolvedValue({ get: () => null });
  prismaMock.rateLimitHit.count.mockResolvedValue(0);
  // checkRateLimit wraps its work in a $transaction (per-key advisory lock).
  prismaMock.$transaction.mockImplementation((cb) =>
    (cb as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock),
  );
});

describe("getVariantStocks", () => {
  it("returns an empty object without querying anything for an empty list", async () => {
    const result = await getVariantStocks("sport", []);

    expect(result).toEqual({});
    expect(prismaMock.productVariant.findMany).not.toHaveBeenCalled();
  });

  it("returns a stock map scoped to the given productType", async () => {
    prismaMock.productVariant.findMany.mockResolvedValue([
      { id: "variant-1", stock: 5 },
      { id: "variant-2", stock: 0 },
    ] as never);

    const result = await getVariantStocks("sport", ["variant-1", "variant-2"]);

    expect(result).toEqual({ "variant-1": 5, "variant-2": 0 });
    expect(prismaMock.productVariant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: ["variant-1", "variant-2"] },
          product: { productType: "sport" },
        },
      }),
    );
  });

  it("returns null instead of an empty object for invalid input", async () => {
    // Regression guard: the cart's SYNC_STOCK reducer treats any variant
    // absent from the returned map as 0 in stock and drops it, so a `{}`
    // here (rather than null) would silently empty a real cart.
    const result = await getVariantStocks("sport", Array(51).fill("variant-1"));

    expect(result).toBeNull();
    expect(prismaMock.productVariant.findMany).not.toHaveBeenCalled();
  });

  it("returns null and does no query once the caller's IP is over the limit", async () => {
    prismaMock.rateLimitHit.count.mockResolvedValue(60);

    const result = await getVariantStocks("sport", ["variant-1"]);

    expect(result).toBeNull();
    expect(prismaMock.productVariant.findMany).not.toHaveBeenCalled();
  });
});

describe("resolveSharedCartLines", () => {
  function variant(overrides: Record<string, unknown> = {}) {
    return {
      id: "variant-1",
      productId: "product-1",
      size: "M",
      color: "Rose",
      stock: 5,
      price: null,
      product: {
        name: "Robe",
        basePrice: { toNumber: () => 1500 },
        images: [{ storagePath: "products/robe.jpg" }],
      },
      ...overrides,
    };
  }

  it("returns an empty list without querying anything for no entries", async () => {
    const result = await resolveSharedCartLines("sport", []);

    expect(result).toEqual([]);
    expect(prismaMock.productVariant.findMany).not.toHaveBeenCalled();
  });

  it("resolves a live variant into a full cart line, scoped to active products of this boutique", async () => {
    prismaMock.productVariant.findMany.mockResolvedValue([variant()] as never);

    const result = await resolveSharedCartLines("sport", [
      { variantId: "variant-1", quantity: 2 },
    ]);

    expect(result).toEqual([
      {
        variantId: "variant-1",
        productId: "product-1",
        productName: "Robe",
        size: "M",
        color: "Rose",
        unitPrice: 1500,
        imageStoragePath: "products/robe.jpg",
        stock: 5,
        quantity: 2,
      },
    ]);
    expect(prismaMock.productVariant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: ["variant-1"] },
          product: { productType: "sport", isActive: true },
        },
      }),
    );
  });

  it("prefers the variant's own price over the product's base price", async () => {
    prismaMock.productVariant.findMany.mockResolvedValue([
      variant({ price: { toNumber: () => 999 } }),
    ] as never);

    const [line] = await resolveSharedCartLines("sport", [
      { variantId: "variant-1", quantity: 1 },
    ]);

    expect(line.unitPrice).toBe(999);
  });

  it("clamps the requested quantity down to live stock", async () => {
    prismaMock.productVariant.findMany.mockResolvedValue([variant({ stock: 2 })] as never);

    const [line] = await resolveSharedCartLines("sport", [
      { variantId: "variant-1", quantity: 10 },
    ]);

    expect(line.quantity).toBe(2);
  });

  it("drops a line whose live stock has hit 0", async () => {
    prismaMock.productVariant.findMany.mockResolvedValue([variant({ stock: 0 })] as never);

    const result = await resolveSharedCartLines("sport", [
      { variantId: "variant-1", quantity: 1 },
    ]);

    expect(result).toEqual([]);
  });

  it("silently drops a variant that no longer matches (deleted, deactivated, or another boutique)", async () => {
    prismaMock.productVariant.findMany.mockResolvedValue([] as never);

    const result = await resolveSharedCartLines("sport", [
      { variantId: "gone", quantity: 1 },
    ]);

    expect(result).toEqual([]);
  });

  it("returns an empty list for malformed input instead of throwing", async () => {
    const result = await resolveSharedCartLines("sport", [
      { variantId: "", quantity: 1 },
    ]);

    expect(result).toEqual([]);
    expect(prismaMock.productVariant.findMany).not.toHaveBeenCalled();
  });

  it("returns an empty list once the caller's IP is over the limit", async () => {
    prismaMock.rateLimitHit.count.mockResolvedValue(30);

    const result = await resolveSharedCartLines("sport", [
      { variantId: "variant-1", quantity: 1 },
    ]);

    expect(result).toEqual([]);
    expect(prismaMock.productVariant.findMany).not.toHaveBeenCalled();
  });
});
