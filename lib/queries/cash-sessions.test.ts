import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/lib/generated/prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from "@/lib/prisma";
import { getSessionView, listSessions } from "@/lib/queries/cash-sessions";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

const SELLER = { id: "seller-1", role: "SELLER" as const };
const ADMIN = { id: "admin-1", role: "BOUTIQUE_ADMIN" as const };

beforeEach(() => {
  mockReset(prismaMock);
  prismaMock.cashSession.findMany.mockResolvedValue([]);
  prismaMock.cashSession.count.mockResolvedValue(0);
});

describe("getSessionView", () => {
  it("lets a seller open only their own till in their boutique", async () => {
    prismaMock.cashSession.findFirst.mockResolvedValue(null);

    expect(await getSessionView("session-of-seller-2", "sport", SELLER)).toBeNull();
    expect(prismaMock.cashSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "session-of-seller-2", productType: "sport", sellerId: "seller-1" },
      }),
    );
  });

  it("lets an admin open any till, but only in their boutique", async () => {
    prismaMock.cashSession.findFirst.mockResolvedValue(null);

    await getSessionView("session-1", "sport", ADMIN);

    expect(prismaMock.cashSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "session-1", productType: "sport" } }),
    );
  });

  it("shows a closed till's frozen totals, not a recomputation", async () => {
    const frozen = {
      openingFloat: 1000,
      breakdown: [],
      salesTotal: 2300,
      salesCount: 3,
      cashIn: 0,
      cashOut: 0,
      expectedCash: 2500,
    };
    prismaMock.cashSession.findFirst.mockResolvedValue({
      id: "session-1",
      productType: "sport",
      status: "CLOSED",
      openingFloat: { toNumber: () => 1000 },
      closingSummary: frozen,
      countedCash: { toNumber: () => 2500 },
      cashDifference: { toNumber: () => 0 },
      movements: [],
      sales: [],
    } as never);

    const view = await getSessionView("session-1", "sport", ADMIN);

    expect(view?.totals).toEqual(frozen);
    expect(prismaMock.sale.groupBy).not.toHaveBeenCalled();
  });
});

describe("listSessions", () => {
  it("lists a seller's own tills only", async () => {
    await listSessions("sport", SELLER);

    expect(prismaMock.cashSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { productType: "sport", sellerId: "seller-1" } }),
    );
  });

  it("lists every till of the boutique for an admin", async () => {
    await listSessions("sport", ADMIN);

    expect(prismaMock.cashSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { productType: "sport" } }),
    );
  });
});
