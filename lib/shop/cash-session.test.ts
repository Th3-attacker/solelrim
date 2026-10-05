import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/lib/generated/prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from "@/lib/prisma";
import { AUTO_CLOSE_NOTE, STALE_SESSION_MS, closeStaleSessions } from "@/lib/shop/cash-session";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const now = new Date("2026-10-05T12:00:00Z");

beforeEach(() => {
  mockReset(prismaMock);
  prismaMock.$transaction.mockImplementation((cb) =>
    (cb as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock),
  );
  (prismaMock.sale.groupBy as unknown as Mock).mockResolvedValue([]);
  (prismaMock.cashMovement.groupBy as unknown as Mock).mockResolvedValue([]);
  prismaMock.walletAccount.findMany.mockResolvedValue([]);
  prismaMock.refundRequest.aggregate.mockResolvedValue({ _sum: { amount: null } } as never);
});

describe("closeStaleSessions", () => {
  it("only looks at tills opened more than 24 hours ago", async () => {
    prismaMock.cashSession.findMany.mockResolvedValue([]);

    await closeStaleSessions("sport", now);

    expect(prismaMock.cashSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          productType: "sport",
          status: "OPEN",
          openedAt: { lt: new Date(now.getTime() - STALE_SESSION_MS) },
        },
      }),
    );
    expect(prismaMock.cashSession.updateMany).not.toHaveBeenCalled();
  });

  it("closes a forgotten till with an automatic reason, without inventing a count", async () => {
    prismaMock.cashSession.findMany.mockResolvedValue([{ id: "s1" }] as never);
    prismaMock.cashSession.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.cashSession.findUniqueOrThrow.mockResolvedValue({
      id: "s1",
      sellerEmail: "seller@shop.mr",
      openingFloat: { toNumber: () => 1000 },
    } as never);

    await closeStaleSessions("sport", now);

    expect(prismaMock.cashSession.updateMany).toHaveBeenCalledWith({
      where: { id: "s1", status: "OPEN" },
      data: { status: "CLOSED", closedAt: now, autoClosed: true, closingNote: AUTO_CLOSE_NOTE },
    });
    const frozen = prismaMock.cashSession.update.mock.calls[0][0].data;
    expect(frozen).toMatchObject({ expectedCash: 1000 });
    expect(frozen).not.toHaveProperty("countedCash");
    expect(prismaMock.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "cash.autoClose",
        targetId: "s1",
        adminEmail: "system",
        reason: AUTO_CLOSE_NOTE,
      }),
    });
  });

  it("leaves a till someone else just closed alone", async () => {
    prismaMock.cashSession.findMany.mockResolvedValue([{ id: "s1" }] as never);
    prismaMock.cashSession.updateMany.mockResolvedValue({ count: 0 });

    await closeStaleSessions("sport", now);

    expect(prismaMock.adminAuditLog.create).not.toHaveBeenCalled();
    expect(prismaMock.cashSession.update).not.toHaveBeenCalled();
  });

  it("never throws: a failed sweep is logged and the caller carries on", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    prismaMock.cashSession.findMany.mockRejectedValue(new Error("db down"));

    await expect(closeStaleSessions("sport", now)).resolves.toBeUndefined();

    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
