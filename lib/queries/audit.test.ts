import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/lib/generated/prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from "@/lib/prisma";
import { getAuditLog, getAuditLogActors } from "@/lib/queries/audit";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

beforeEach(() => {
  mockReset(prismaMock);
  prismaMock.adminAuditLog.findMany.mockResolvedValue([]);
  prismaMock.adminAuditLog.count.mockResolvedValue(0);
});

describe("getAuditLog", () => {
  it("only reads the given boutique's entries", async () => {
    await getAuditLog("sport", { action: "sale.create", adminUserId: "seller-1" });

    expect(prismaMock.adminAuditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productType: "sport", action: "sale.create", adminUserId: "seller-1" },
      }),
    );
    expect(prismaMock.adminAuditLog.count).toHaveBeenCalledWith({
      where: { productType: "sport", action: "sale.create", adminUserId: "seller-1" },
    });
  });

  it("reads every boutique only when given no boutique (superadmin)", async () => {
    await getAuditLog(null);

    expect(prismaMock.adminAuditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it("searches the user, the reference and the reason", async () => {
    await getAuditLog("sport", { search: "erreur" });

    expect(prismaMock.adminAuditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          productType: "sport",
          OR: [
            { adminEmail: { contains: "erreur", mode: "insensitive" } },
            { targetLabel: { contains: "erreur", mode: "insensitive" } },
            { reason: { contains: "erreur", mode: "insensitive" } },
          ],
        },
      }),
    );
  });
});

describe("getAuditLogActors", () => {
  it("lists the boutique's users once each, sorted by email", async () => {
    prismaMock.adminAuditLog.findMany.mockResolvedValue([
      { adminUserId: "u2", adminEmail: "zeina@shop.mr" },
      { adminUserId: "u1", adminEmail: "amina@shop.mr" },
    ] as never);

    const actors = await getAuditLogActors("sport");

    expect(actors).toEqual([
      { id: "u1", email: "amina@shop.mr" },
      { id: "u2", email: "zeina@shop.mr" },
    ]);
    expect(prismaMock.adminAuditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { productType: "sport" }, distinct: ["adminUserId"] }),
    );
  });
});
