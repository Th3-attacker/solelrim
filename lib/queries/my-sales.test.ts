import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/lib/generated/prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from "@/lib/prisma";
import { getMySales } from "@/lib/queries/my-sales";
import { parseMySalesFilters } from "@/lib/shop/my-sales-filters";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const groupByMock = prismaMock.sale.groupBy as unknown as Mock;

function decimal(value: number) {
  return { toNumber: () => value, valueOf: () => value };
}

beforeEach(() => {
  mockReset(prismaMock);
  prismaMock.sale.findMany.mockResolvedValue([]);
  prismaMock.sale.count.mockResolvedValue(0);
  groupByMock.mockResolvedValue([]);
  prismaMock.walletAccount.findMany.mockResolvedValue([
    { provider: "Bankily" },
    { provider: "Masrvi" },
  ] as never);
});

describe("getMySales", () => {
  it("never reads another seller's or another boutique's sales", async () => {
    await getMySales("sport", "seller-1", parseMySalesFilters({ payment: "cash" }));

    const scope = { productType: "sport", sellerId: "seller-1" };
    expect(prismaMock.sale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining(scope) }),
    );
    expect(prismaMock.sale.count).toHaveBeenCalledWith({ where: expect.objectContaining(scope) });
    expect(groupByMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ ...scope, status: "COMPLETED" }) }),
    );
  });

  it("totals only completed sales, with cash and each wallet apart", async () => {
    prismaMock.sale.count.mockResolvedValue(5);
    groupByMock.mockResolvedValue([
      { paymentMethod: "cash", walletProvider: null, _sum: { total: decimal(3000) }, _count: { _all: 2 } },
      { paymentMethod: "wallet", walletProvider: "Masrvi", _sum: { total: decimal(1250.5) }, _count: { _all: 2 } },
    ]);

    const { summary } = await getMySales("sport", "seller-1", parseMySalesFilters({}));

    expect(summary.salesCount).toBe(4);
    expect(summary.cancelledCount).toBe(1);
    expect(summary.soldTotal).toBe(4250.5);
    expect(summary.breakdown).toEqual([
      { method: "cash", provider: null, total: 3000, count: 2 },
      { method: "wallet", provider: "Bankily", total: 0, count: 0 },
      { method: "wallet", provider: "Masrvi", total: 1250.5, count: 2 },
    ]);
  });

  it("sums nothing when filtering on cancelled sales", async () => {
    prismaMock.sale.count.mockResolvedValue(2);
    const { summary } = await getMySales(
      "sport",
      "seller-1",
      parseMySalesFilters({ status: "CANCELLED" }),
    );

    expect(groupByMock).not.toHaveBeenCalled();
    expect(summary.soldTotal).toBe(0);
    expect(summary.salesCount).toBe(0);
    expect(summary.cancelledCount).toBe(2);
  });
});
