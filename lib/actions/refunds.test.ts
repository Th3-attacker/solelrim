import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
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
import { approveRefund, rejectRefund, requestRefund } from "@/lib/actions/refunds";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const createClientMock = createClient as unknown as Mock;

// Like Prisma's Decimal: both toNumber() and Number(decimal) work.
function decimal(value: number) {
  return { toNumber: () => value, valueOf: () => value };
}

function signedInAs(role: "BOUTIQUE_ADMIN" | "SELLER") {
  const id = role === "SELLER" ? "seller-1" : "admin-1";
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
  prismaMock.storeType.findUnique.mockResolvedValue({
    licenseType: "MONTHLY",
    licenseStatus: "ACTIVE",
    licenseExpiresAt: null,
  } as never);
}

// 2 × 600 + 1 × 800 = 2 000; 200 off → 1 800 paid in cash; 18 points
// earned, 100 spent.
function sale(overrides: Record<string, unknown> = {}) {
  return {
    id: "sale-1",
    reference: "VNT-1",
    status: "COMPLETED",
    clientId: "client-1",
    paymentMethod: "cash",
    walletProvider: null,
    subtotal: decimal(2000),
    total: decimal(1800),
    refundedAmount: decimal(0),
    loyaltyPointsEarned: 18,
    loyaltyPointsRedeemed: 100,
    items: [
      { id: "item-a", variantId: "variant-a", unitPrice: decimal(600), quantity: 2, refundedQuantity: 0 },
      { id: "item-b", variantId: "variant-b", unitPrice: decimal(800), quantity: 1, refundedQuantity: 0 },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  mockReset(prismaMock);
  createClientMock.mockReset();
  prismaMock.$transaction.mockImplementation((cb) =>
    (cb as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock),
  );
  // requestRefund's locked re-read of the sale.
  prismaMock.$queryRaw.mockResolvedValue([{ status: "COMPLETED" }] as never);
});

describe("requestRefund", () => {
  it("lets a seller ask for some units of a sale of their boutique, with a reason", async () => {
    signedInAs("SELLER");
    prismaMock.sale.findFirst.mockResolvedValue(sale() as never);
    prismaMock.refundRequest.create.mockResolvedValue({ id: "request-1" } as never);

    const result = await requestRefund({
      saleId: "sale-1",
      items: [{ saleItemId: "item-a", quantity: 1 }],
      reason: "Taille trop petite",
    });

    expect(result).toEqual({ requestId: "request-1" });
    expect(prismaMock.sale.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "sale-1", productType: "sport" } }),
    );
    expect(prismaMock.refundRequest.create).toHaveBeenCalledWith({
      data: {
        productType: "sport",
        saleId: "sale-1",
        reason: "Taille trop petite",
        requestedById: "seller-1",
        requestedByEmail: "seller-1@shop.mr",
        items: { create: [{ saleItemId: "item-a", quantity: 1 }] },
      },
    });
    expect(prismaMock.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "refund.request",
        reason: "Taille trop petite",
        newValue: { items: 1, estimatedAmount: 540 },
      }),
    });
  });

  it("refuses a sale of another boutique", async () => {
    signedInAs("SELLER");
    prismaMock.sale.findFirst.mockResolvedValue(null);

    expect(
      await requestRefund({
        saleId: "other-boutique-sale",
        items: [{ saleItemId: "item-a", quantity: 1 }],
        reason: "Défaut",
      }),
    ).toEqual({ error: "notFound" });
  });

  it("refuses more units than are left to refund, or a line of another sale", async () => {
    signedInAs("SELLER");
    prismaMock.sale.findFirst.mockResolvedValue(
      sale({
        items: [
          { id: "item-a", variantId: "variant-a", unitPrice: decimal(600), quantity: 2, refundedQuantity: 2 },
        ],
      }) as never,
    );

    expect(
      await requestRefund({
        saleId: "sale-1",
        items: [{ saleItemId: "item-a", quantity: 1 }],
        reason: "Défaut",
      }),
    ).toEqual({ error: "invalidQuantity" });
    expect(
      await requestRefund({
        saleId: "sale-1",
        items: [{ saleItemId: "item-of-another-sale", quantity: 1 }],
        reason: "Défaut",
      }),
    ).toEqual({ error: "invalidQuantity" });
    expect(prismaMock.refundRequest.create).not.toHaveBeenCalled();
  });

  it("refuses a cancelled sale", async () => {
    signedInAs("SELLER");
    prismaMock.sale.findFirst.mockResolvedValue(sale({ status: "CANCELLED" }) as never);

    expect(
      await requestRefund({
        saleId: "sale-1",
        items: [{ saleItemId: "item-a", quantity: 1 }],
        reason: "Défaut",
      }),
    ).toEqual({ error: "notRefundable" });
  });

  it("refuses a sale cancelled between the first read and the save", async () => {
    signedInAs("SELLER");
    prismaMock.sale.findFirst.mockResolvedValue(sale() as never);
    prismaMock.$queryRaw.mockResolvedValue([{ status: "CANCELLED" }] as never);

    expect(
      await requestRefund({
        saleId: "sale-1",
        items: [{ saleItemId: "item-a", quantity: 1 }],
        reason: "Défaut",
      }),
    ).toEqual({ error: "notRefundable" });
    expect(prismaMock.refundRequest.create).not.toHaveBeenCalled();
  });

  it("allows one pending request per sale", async () => {
    signedInAs("SELLER");
    prismaMock.sale.findFirst.mockResolvedValue(sale() as never);
    prismaMock.refundRequest.create.mockRejectedValue(
      new PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    expect(
      await requestRefund({
        saleId: "sale-1",
        items: [{ saleItemId: "item-a", quantity: 1 }],
        reason: "Défaut",
      }),
    ).toEqual({ error: "alreadyPending" });
  });

  it("requires a reason", async () => {
    signedInAs("SELLER");

    expect(
      await requestRefund({
        saleId: "sale-1",
        items: [{ saleItemId: "item-a", quantity: 1 }],
        reason: "  ",
      }),
    ).toEqual({ error: "invalid" });
  });
});

describe("approveRefund", () => {
  function pendingRequest(items = [{ saleItemId: "item-a", quantity: 1 }], saleOverrides = {}) {
    prismaMock.refundRequest.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.refundRequest.findUniqueOrThrow.mockResolvedValue({
      id: "request-1",
      saleId: "sale-1",
      reason: "Taille trop petite",
      items,
    } as never);
    prismaMock.sale.findUniqueOrThrow.mockResolvedValue(sale(saleOverrides) as never);
    prismaMock.refundRequest.aggregate.mockResolvedValue({
      _sum: { loyaltyPointsTakenBack: null, loyaltyPointsReturned: null },
    } as never);
    prismaMock.saleItem.updateMany.mockResolvedValue({ count: 1 });
    // Sale lock, the approver's till, the client's points (in that order).
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ id: "sale-1" }] as never)
      .mockResolvedValueOnce([{ id: "session-9", openingFloat: "5000" }] as never)
      .mockResolvedValueOnce([{ loyaltyPoints: 40 }] as never);
    // The approver's till holds its 5 000 float.
    (prismaMock.sale.groupBy as unknown as Mock).mockResolvedValue([]);
    (prismaMock.cashMovement.groupBy as unknown as Mock).mockResolvedValue([]);
    prismaMock.walletAccount.findMany.mockResolvedValue([]);
  }

  it("never lets a seller approve", async () => {
    signedInAs("SELLER");

    await expect(approveRefund({ requestId: "request-1" })).rejects.toThrow("forbidden");
    expect(prismaMock.refundRequest.updateMany).not.toHaveBeenCalled();
  });

  it("restocks, pays out of the approver's till, prorates points and moves the sale on — all at once", async () => {
    signedInAs("BOUTIQUE_ADMIN");
    pendingRequest();
    prismaMock.refundRequest.aggregate
      .mockResolvedValueOnce({ _sum: { loyaltyPointsTakenBack: null, loyaltyPointsReturned: null } } as never)
      .mockResolvedValueOnce({ _sum: { amount: null } } as never);

    expect(await approveRefund({ requestId: "request-1" })).toEqual({ requestId: "request-1" });

    expect(prismaMock.refundRequest.updateMany).toHaveBeenCalledWith({
      where: { id: "request-1", productType: "sport", status: "PENDING" },
      data: expect.objectContaining({ status: "APPROVED", decidedById: "admin-1" }),
    });
    expect(prismaMock.saleItem.updateMany).toHaveBeenCalledWith({
      where: { id: "item-a", refundedQuantity: { lte: 1 } },
      data: { refundedQuantity: { increment: 1 } },
    });
    expect(prismaMock.productVariant.update).toHaveBeenCalledWith({
      where: { id: "variant-a" },
      data: { stock: { increment: 1 } },
    });
    // 40 − 5 earned on the item + 30 spent on it = 65.
    expect(prismaMock.client.update).toHaveBeenCalledWith({
      where: { id: "client-1" },
      data: { loyaltyPoints: 65 },
    });
    expect(prismaMock.sale.update).toHaveBeenCalledWith({
      where: { id: "sale-1" },
      data: { refundedAmount: { increment: 540 }, status: "PARTIALLY_REFUNDED" },
    });
    expect(prismaMock.refundRequest.update).toHaveBeenCalledWith({
      where: { id: "request-1" },
      data: expect.objectContaining({
        amount: 540,
        paymentMethod: "cash",
        cashSessionId: "session-9",
        loyaltyPointsTakenBack: 5,
        loyaltyPointsReturned: 30,
      }),
    });
    expect(prismaMock.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "refund.approve", targetLabel: "VNT-1" }),
    });
  });

  it("marks the sale refunded once every unit is back", async () => {
    signedInAs("BOUTIQUE_ADMIN");
    pendingRequest([
      { saleItemId: "item-a", quantity: 2 },
      { saleItemId: "item-b", quantity: 1 },
    ]);
    prismaMock.refundRequest.aggregate
      .mockResolvedValueOnce({ _sum: { loyaltyPointsTakenBack: null, loyaltyPointsReturned: null } } as never)
      .mockResolvedValueOnce({ _sum: { amount: null } } as never);

    await approveRefund({ requestId: "request-1" });

    expect(prismaMock.sale.update).toHaveBeenCalledWith({
      where: { id: "sale-1" },
      data: { refundedAmount: { increment: 1800 }, status: "REFUNDED" },
    });
  });

  it("can't refund units another approval already refunded", async () => {
    signedInAs("BOUTIQUE_ADMIN");
    pendingRequest();
    // The concurrent approval won the guarded increment.
    prismaMock.saleItem.updateMany.mockResolvedValue({ count: 0 });

    expect(await approveRefund({ requestId: "request-1" })).toEqual({ error: "invalidQuantity" });
    expect(prismaMock.sale.update).not.toHaveBeenCalled();
  });

  it("approves a request only once", async () => {
    signedInAs("BOUTIQUE_ADMIN");
    prismaMock.refundRequest.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.refundRequest.findFirst.mockResolvedValue({ id: "request-1" } as never);

    expect(await approveRefund({ requestId: "request-1" })).toEqual({ error: "alreadyDecided" });
    expect(prismaMock.saleItem.updateMany).not.toHaveBeenCalled();
  });

  it("refuses a request of another boutique", async () => {
    signedInAs("BOUTIQUE_ADMIN");
    prismaMock.refundRequest.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.refundRequest.findFirst.mockResolvedValue(null);

    expect(await approveRefund({ requestId: "other-boutique-request" })).toEqual({
      error: "notFound",
    });
  });

  it("needs the approver's own till open for a cash refund", async () => {
    signedInAs("BOUTIQUE_ADMIN");
    pendingRequest();
    prismaMock.$queryRaw.mockReset();
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ id: "sale-1" }] as never)
      .mockResolvedValueOnce([] as never);

    expect(await approveRefund({ requestId: "request-1" })).toEqual({ error: "noOpenSession" });
    expect(prismaMock.sale.update).not.toHaveBeenCalled();
  });

  it("refuses a cash refund the till can't cover", async () => {
    signedInAs("BOUTIQUE_ADMIN");
    pendingRequest();
    prismaMock.$queryRaw.mockReset();
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ id: "sale-1" }] as never)
      .mockResolvedValueOnce([{ id: "session-9", openingFloat: "100" }] as never);
    prismaMock.refundRequest.aggregate
      .mockResolvedValueOnce({ _sum: { loyaltyPointsTakenBack: null, loyaltyPointsReturned: null } } as never)
      .mockResolvedValueOnce({ _sum: { amount: null } } as never);

    expect(await approveRefund({ requestId: "request-1" })).toEqual({ error: "insufficientCash" });
  });

  it("records a wallet refund without touching any till", async () => {
    signedInAs("BOUTIQUE_ADMIN");
    pendingRequest(undefined, { paymentMethod: "wallet", walletProvider: "Bankily", clientId: null });
    prismaMock.$queryRaw.mockReset();
    prismaMock.$queryRaw.mockResolvedValueOnce([{ id: "sale-1" }] as never);

    await approveRefund({ requestId: "request-1" });

    expect(prismaMock.refundRequest.update).toHaveBeenCalledWith({
      where: { id: "request-1" },
      data: expect.objectContaining({
        paymentMethod: "wallet",
        walletProvider: "Bankily",
        cashSessionId: null,
      }),
    });
  });

  it("refuses a sale cancelled since the request", async () => {
    signedInAs("BOUTIQUE_ADMIN");
    pendingRequest(undefined, { status: "CANCELLED" });

    expect(await approveRefund({ requestId: "request-1" })).toEqual({ error: "notRefundable" });
  });
});

describe("rejectRefund", () => {
  it("requires a reason", async () => {
    signedInAs("BOUTIQUE_ADMIN");

    expect(await rejectRefund({ requestId: "request-1", reason: "" })).toEqual({
      error: "invalid",
    });
  });

  it("rejects a pending request with its reason, in the audit log too", async () => {
    signedInAs("BOUTIQUE_ADMIN");
    prismaMock.refundRequest.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.refundRequest.findUniqueOrThrow.mockResolvedValue({
      id: "request-1",
      sale: { id: "sale-1", reference: "VNT-1" },
    } as never);

    expect(
      await rejectRefund({ requestId: "request-1", reason: "Article porté" }),
    ).toEqual({ requestId: "request-1" });
    expect(prismaMock.refundRequest.updateMany).toHaveBeenCalledWith({
      where: { id: "request-1", productType: "sport", status: "PENDING" },
      data: expect.objectContaining({ status: "REJECTED", rejectionReason: "Article porté" }),
    });
    expect(prismaMock.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "refund.reject", reason: "Article porté" }),
    });
  });

  it("never lets a seller reject", async () => {
    signedInAs("SELLER");

    await expect(rejectRefund({ requestId: "request-1", reason: "Non" })).rejects.toThrow(
      "forbidden",
    );
  });
});
