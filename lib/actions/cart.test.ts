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
import { getVariantStocks } from "@/lib/actions/cart";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const headersMock = headers as unknown as Mock;

beforeEach(() => {
  mockReset(prismaMock);
  headersMock.mockResolvedValue({ get: () => null });
  prismaMock.rateLimitHit.count.mockResolvedValue(0);
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
