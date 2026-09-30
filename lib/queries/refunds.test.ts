import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/lib/generated/prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from "@/lib/prisma";
import { getSaleRefunds, listRefundRequests } from "@/lib/queries/refunds";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

beforeEach(() => {
  mockReset(prismaMock);
  prismaMock.refundRequest.findMany.mockResolvedValue([]);
  prismaMock.refundRequest.count.mockResolvedValue(0);
});

describe("listRefundRequests", () => {
  it("shows a seller only their own requests, in their boutique", async () => {
    await listRefundRequests("sport", { id: "seller-1", role: "SELLER" }, null);

    expect(prismaMock.refundRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { productType: "sport", requestedById: "seller-1" } }),
    );
  });

  it("shows an admin every request of the boutique", async () => {
    await listRefundRequests("sport", { id: "admin-1", role: "BOUTIQUE_ADMIN" }, "PENDING");

    expect(prismaMock.refundRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { productType: "sport", status: "PENDING" } }),
    );
  });
});

describe("getSaleRefunds", () => {
  it("only finds a sale of the caller's boutique", async () => {
    prismaMock.sale.findFirst.mockResolvedValue(null);

    expect(await getSaleRefunds("other-boutique-sale", "sport")).toBeNull();
    expect(prismaMock.sale.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "other-boutique-sale", productType: "sport" } }),
    );
  });
});
