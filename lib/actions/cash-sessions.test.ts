import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaClientKnownRequestError } from "@/lib/generated/prisma/internal/prismaNamespace";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import {
  addCashMovement,
  closeCashSession,
  closeStoreDay,
  openCashSession,
} from "@/lib/actions/cash-sessions";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const createClientMock = createClient as unknown as Mock;

// Like Prisma's Decimal: both toNumber() and Number(decimal) work.
function decimal(value: number) {
  return { toNumber: () => value, valueOf: () => value };
}

function signedInAs(role: "BOUTIQUE_ADMIN" | "SELLER", id = role === "SELLER" ? "seller-1" : "admin-1") {
  createClientMock.mockResolvedValue({
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: { id: `auth-${id}`, email: `${id}@shop.mr` } } }),
    },
  });
  prismaMock.adminUser.findUnique.mockResolvedValue({
    id,
    supabaseUserId: `auth-${id}`,
    role,
    productType: "sport",
    canManageAppearance: false,
    createdAt: new Date(),
  } as never);
}

function license(status: "ACTIVE" | "SUSPENDED") {
  prismaMock.storeType.findUnique.mockResolvedValue({
    licenseType: "MONTHLY",
    licenseStatus: status,
    licenseExpiresAt: null,
  } as never);
}

// A till holding 1 000 float + 1 500 cash sales + 200 in − 100 out = 2 600.
function tillFigures() {
  (prismaMock.sale.groupBy as unknown as Mock).mockResolvedValue([
    { paymentMethod: "cash", walletProvider: null, _sum: { total: decimal(1500) }, _count: { _all: 2 } },
    { paymentMethod: "wallet", walletProvider: "Bankily", _sum: { total: decimal(800) }, _count: { _all: 1 } },
  ]);
  (prismaMock.cashMovement.groupBy as unknown as Mock).mockResolvedValue([
    { type: "IN", _sum: { amount: decimal(200) } },
    { type: "OUT", _sum: { amount: decimal(100) } },
  ]);
  prismaMock.walletAccount.findMany.mockResolvedValue([{ provider: "Bankily" }] as never);
}

beforeEach(() => {
  mockReset(prismaMock);
  createClientMock.mockReset();
  prismaMock.$transaction.mockImplementation((cb) =>
    (cb as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock),
  );
  license("ACTIVE");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-30T15:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("openCashSession", () => {
  it("opens the caller's own till with their float, on today's business day", async () => {
    signedInAs("SELLER");
    prismaMock.storeDayClosure.findUnique.mockResolvedValue(null);
    prismaMock.cashSession.create.mockResolvedValue({ id: "session-1" } as never);

    const result = await openCashSession({ openingFloat: 1000 });

    expect(result).toEqual({ sessionId: "session-1" });
    expect(prismaMock.cashSession.create).toHaveBeenCalledWith({
      data: {
        productType: "sport",
        sellerId: "seller-1",
        sellerEmail: "seller-1@shop.mr",
        sellerRole: "SELLER",
        openingFloat: 1000,
        businessDate: new Date("2026-09-30T00:00:00Z"),
      },
    });
    expect(prismaMock.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "cash.open",
        adminRole: "SELLER",
        targetId: "session-1",
        newValue: { openingFloat: 1000 },
      }),
    });
  });

  it("allows only one open till per seller", async () => {
    signedInAs("SELLER");
    prismaMock.storeDayClosure.findUnique.mockResolvedValue(null);
    prismaMock.cashSession.create.mockRejectedValue(
      new PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    expect(await openCashSession({ openingFloat: 1000 })).toEqual({ error: "alreadyOpen" });
  });

  it("refuses to open a till on a day the boutique already closed", async () => {
    signedInAs("SELLER");
    prismaMock.storeDayClosure.findUnique.mockResolvedValue({ id: "closure-1" } as never);

    expect(await openCashSession({ openingFloat: 1000 })).toEqual({ error: "dayClosed" });
    expect(prismaMock.cashSession.create).not.toHaveBeenCalled();
  });

  it("refuses a negative float", async () => {
    signedInAs("SELLER");

    expect(await openCashSession({ openingFloat: -5 })).toEqual({ error: "invalid" });
  });

  it("reports licenseBlocked for a suspended boutique", async () => {
    signedInAs("SELLER");
    license("SUSPENDED");

    expect(await openCashSession({ openingFloat: 1000 })).toEqual({ error: "licenseBlocked" });
  });
});

describe("addCashMovement", () => {
  it("only ever touches the caller's own open till in their boutique", async () => {
    signedInAs("SELLER");
    prismaMock.$queryRaw.mockResolvedValue([] as never);

    const result = await addCashMovement({ type: "IN", amount: 200, reason: "Appoint" });

    expect(result).toEqual({ error: "noOpenSession" });
    const [, ...lookupValues] = prismaMock.$queryRaw.mock.calls[0];
    expect(lookupValues).toEqual(["seller-1", "sport"]);
    expect(prismaMock.cashMovement.create).not.toHaveBeenCalled();
  });

  it("records cash in with its reason, in the audit log too", async () => {
    signedInAs("SELLER");
    prismaMock.$queryRaw.mockResolvedValue([{ id: "session-1", openingFloat: "1000" }] as never);
    prismaMock.cashMovement.create.mockResolvedValue({ id: "movement-1" } as never);

    await addCashMovement({ type: "IN", amount: 200, reason: "  Appoint de monnaie " });

    expect(prismaMock.cashMovement.create).toHaveBeenCalledWith({
      data: {
        sessionId: "session-1",
        type: "IN",
        amount: 200,
        reason: "Appoint de monnaie",
        createdById: "seller-1",
      },
    });
    expect(prismaMock.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "cash.in", reason: "Appoint de monnaie" }),
    });
  });

  it("refuses taking out more cash than the till should hold", async () => {
    signedInAs("SELLER");
    prismaMock.$queryRaw.mockResolvedValue([{ id: "session-1", openingFloat: "1000" }] as never);
    tillFigures();

    const result = await addCashMovement({ type: "OUT", amount: 2600.01, reason: "Dépôt banque" });

    expect(result).toEqual({ error: "insufficientCash" });
    expect(prismaMock.cashMovement.create).not.toHaveBeenCalled();
  });

  it("requires a reason", async () => {
    signedInAs("SELLER");

    expect(await addCashMovement({ type: "OUT", amount: 100, reason: " " })).toEqual({
      error: "invalid",
    });
  });
});

describe("closeCashSession", () => {
  function openTill() {
    prismaMock.cashSession.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.cashSession.findUniqueOrThrow.mockResolvedValue({
      id: "session-1",
      sellerEmail: "seller-1@shop.mr",
      openingFloat: decimal(1000),
    } as never);
    tillFigures();
  }

  it("records the count, the server-computed expected cash and the difference", async () => {
    signedInAs("SELLER");
    openTill();

    const result = await closeCashSession({
      sessionId: "session-1",
      countedCash: 2550,
      note: "Rendu de monnaie erroné",
    });

    expect(result).toEqual({ sessionId: "session-1" });
    expect(prismaMock.cashSession.updateMany).toHaveBeenCalledWith({
      where: { id: "session-1", productType: "sport", status: "OPEN", sellerId: "seller-1" },
      data: expect.objectContaining({ status: "CLOSED", closedById: "seller-1" }),
    });
    expect(prismaMock.cashSession.update).toHaveBeenCalledWith({
      where: { id: "session-1" },
      data: expect.objectContaining({
        expectedCash: 2600,
        countedCash: 2550,
        cashDifference: -50,
        closingNote: "Rendu de monnaie erroné",
        closingSummary: expect.objectContaining({ salesTotal: 2300, expectedCash: 2600 }),
      }),
    });
    expect(prismaMock.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "cash.close",
        reason: "Rendu de monnaie erroné",
        newValue: expect.objectContaining({ cashDifference: -50 }),
      }),
    });
  });

  it("requires a comment when the count doesn't match", async () => {
    signedInAs("SELLER");
    openTill();

    expect(await closeCashSession({ sessionId: "session-1", countedCash: 2550 })).toEqual({
      error: "noteRequired",
    });
    expect(prismaMock.cashSession.update).not.toHaveBeenCalled();
  });

  it("closes without a comment when the count matches", async () => {
    signedInAs("SELLER");
    openTill();

    expect(await closeCashSession({ sessionId: "session-1", countedCash: 2600 })).toEqual({
      sessionId: "session-1",
    });
  });

  it("never lets a seller close another seller's till", async () => {
    signedInAs("SELLER");
    prismaMock.cashSession.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.cashSession.findFirst.mockResolvedValue(null);

    const result = await closeCashSession({ sessionId: "session-of-seller-2", countedCash: 0 });

    expect(result).toEqual({ error: "notFound" });
    expect(prismaMock.cashSession.findFirst).toHaveBeenCalledWith({
      where: { id: "session-of-seller-2", productType: "sport", sellerId: "seller-1" },
      select: { id: true },
    });
  });

  it("lets the boutique admin close a till a seller left open", async () => {
    signedInAs("BOUTIQUE_ADMIN");
    openTill();

    await closeCashSession({ sessionId: "session-1", countedCash: 2600 });

    expect(prismaMock.cashSession.updateMany).toHaveBeenCalledWith({
      where: { id: "session-1", productType: "sport", status: "OPEN" },
      data: expect.objectContaining({ closedById: "admin-1" }),
    });
  });

  it("reports alreadyClosed for a till closed in the meantime", async () => {
    signedInAs("SELLER");
    prismaMock.cashSession.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.cashSession.findFirst.mockResolvedValue({ id: "session-1" } as never);

    expect(await closeCashSession({ sessionId: "session-1", countedCash: 0 })).toEqual({
      error: "alreadyClosed",
    });
  });
});

describe("closeStoreDay", () => {
  function closedTill(overrides: Record<string, unknown> = {}) {
    return {
      id: "session-1",
      productType: "sport",
      status: "CLOSED",
      openingFloat: decimal(1000),
      countedCash: decimal(2550),
      closingSummary: {
        openingFloat: 1000,
        breakdown: [
          { method: "cash", provider: null, total: 1500, count: 2 },
          { method: "wallet", provider: "Bankily", total: 800, count: 1 },
        ],
        salesTotal: 2300,
        salesCount: 3,
        cashIn: 200,
        cashOut: 100,
        expectedCash: 2600,
      },
      ...overrides,
    };
  }

  it("never lets a seller close the boutique's day", async () => {
    signedInAs("SELLER");

    await expect(closeStoreDay({ date: "2026-09-30" })).rejects.toThrow("forbidden");
  });

  it("consolidates every till's frozen totals into the day's closure", async () => {
    signedInAs("BOUTIQUE_ADMIN");
    prismaMock.cashSession.findMany.mockResolvedValue([
      closedTill(),
      closedTill({
        id: "session-2",
        countedCash: decimal(500),
        closingSummary: {
          openingFloat: 500,
          breakdown: [{ method: "cash", provider: null, total: 0, count: 0 }],
          salesTotal: 0,
          salesCount: 0,
          cashIn: 0,
          cashOut: 0,
          expectedCash: 500,
        },
      }),
    ] as never);

    expect(await closeStoreDay({ date: "2026-09-30" })).toEqual({});
    expect(prismaMock.cashSession.findMany).toHaveBeenCalledWith({
      where: { productType: "sport", businessDate: new Date("2026-09-30T00:00:00Z") },
    });
    expect(prismaMock.storeDayClosure.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productType: "sport",
        businessDate: new Date("2026-09-30T00:00:00Z"),
        closedById: "admin-1",
        sessionCount: 2,
        salesCount: 3,
        salesTotal: 2300,
        expectedCash: 3100,
        countedCash: 3050,
        cashDifference: -50,
      }),
    });
  });

  it("refuses while a till of that day is still open", async () => {
    signedInAs("BOUTIQUE_ADMIN");
    prismaMock.cashSession.findMany.mockResolvedValue([
      closedTill(),
      closedTill({ id: "session-2", status: "OPEN" }),
    ] as never);

    expect(await closeStoreDay({ date: "2026-09-30" })).toEqual({ error: "openSessions" });
    expect(prismaMock.storeDayClosure.create).not.toHaveBeenCalled();
  });

  it("refuses a day with no till", async () => {
    signedInAs("BOUTIQUE_ADMIN");
    prismaMock.cashSession.findMany.mockResolvedValue([]);

    expect(await closeStoreDay({ date: "2026-09-30" })).toEqual({ error: "noSessions" });
  });

  it("closes a day only once", async () => {
    signedInAs("BOUTIQUE_ADMIN");
    prismaMock.cashSession.findMany.mockResolvedValue([closedTill()] as never);
    prismaMock.storeDayClosure.create.mockRejectedValue(
      new PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    expect(await closeStoreDay({ date: "2026-09-30" })).toEqual({ error: "alreadyClosed" });
  });

  it("refuses a future day", async () => {
    signedInAs("BOUTIQUE_ADMIN");

    expect(await closeStoreDay({ date: "2026-10-01" })).toEqual({ error: "invalid" });
    expect(prismaMock.cashSession.findMany).not.toHaveBeenCalled();
  });
});
