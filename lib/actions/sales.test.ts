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
import { revalidatePath } from "next/cache";
import { createSale, cancelSale, updateSale } from "@/lib/actions/sales";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const createClientMock = createClient as unknown as Mock;
const revalidatePathMock = revalidatePath as unknown as Mock;

function decimal(value: number) {
  return { toNumber: () => value };
}

function collisionError() {
  return new PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

// Same fixture shape as lib/actions/orders.test.ts: a BOUTIQUE_ADMIN so
// requireAdminScope() resolves productType straight from the admin row,
// without needing next/headers cookies().
function asAdmin(productType = "cosmetique") {
  createClientMock.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-1" } } }) },
  });
  prismaMock.adminUser.findUnique.mockResolvedValue({
    id: "admin-user-1",
    supabaseUserId: "admin-1",
    role: "BOUTIQUE_ADMIN",
    productType,
    createdAt: new Date(),
  } as never);
}

function baseVariant(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "variant-1",
    stock: 10,
    price: null,
    product: { productType: "cosmetique", basePrice: decimal(20) },
    ...overrides,
  };
}

beforeEach(() => {
  mockReset(prismaMock);
  prismaMock.cashSession.findMany.mockResolvedValue([]); // no stale till to auto-close
  createClientMock.mockReset();
  revalidatePathMock.mockReset();
  asAdmin();
  prismaMock.$transaction.mockImplementation((cb) =>
    (cb as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock),
  );
  prismaMock.$queryRaw.mockResolvedValue([{ id: "session-1" }] as never);
});

describe("createSale", () => {
  it("refuses a back-office sale while the admin's own till is closed", async () => {
    prismaMock.$queryRaw.mockResolvedValue([] as never);

    const result = await createSale({
      clientId: null,
      discount: 0,
      paymentMethod: "cash",
      items: [{ variantId: "variant-1", quantity: 2 }],
    });

    expect(result.error).toBe("noOpenSession");
    expect(prismaMock.sale.create).not.toHaveBeenCalled();
  });

  it("creates a sale, decrements stock, and returns the sale id", async () => {
    prismaMock.productVariant.findMany.mockResolvedValue([baseVariant()] as never);
    prismaMock.productVariant.updateMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.sale.create.mockResolvedValue({ id: "sale-1" } as never);

    const result = await createSale({
      clientId: null,
      discount: 0,
      paymentMethod: "cash",
      items: [{ variantId: "variant-1", quantity: 2 }],
    });

    expect(result.error).toBeUndefined();
    expect(result.saleId).toBe("sale-1");
    expect(prismaMock.productVariant.updateMany).toHaveBeenCalledWith({
      where: { id: "variant-1", stock: { gte: 2 } },
      data: { stock: { decrement: 2 } },
    });
    expect(prismaMock.sale.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productType: "cosmetique",
          total: 40,
          // A manual sale is attributed to the admin who recorded it, same
          // as a checkout sale is to its seller.
          sellerId: "admin-user-1",
        }),
      }),
    );
  });

  it("rejects a SELLER — the manual sale form is admin-only, sellers use the checkout", async () => {
    prismaMock.adminUser.findUnique.mockResolvedValue({
      id: "seller-1",
      supabaseUserId: "admin-1",
      role: "SELLER",
      productType: "cosmetique",
      createdAt: new Date(),
    } as never);

    await expect(
      createSale({
        clientId: null,
        discount: 0,
        paymentMethod: "cash",
        items: [{ variantId: "variant-1", quantity: 1 }],
      }),
    ).rejects.toThrow("forbidden");
  });

  it("rejects a variant belonging to a different boutique (tenant isolation)", async () => {
    prismaMock.productVariant.findMany.mockResolvedValue([
      baseVariant({ product: { productType: "sport", basePrice: decimal(20) } }),
    ] as never);

    const result = await createSale({
      clientId: null,
      discount: 0,
      paymentMethod: null,
      items: [{ variantId: "variant-1", quantity: 1 }],
    });

    expect(result.error).toBe("invalid");
    expect(prismaMock.sale.create).not.toHaveBeenCalled();
  });

  it("rejects a client belonging to a different boutique", async () => {
    prismaMock.productVariant.findMany.mockResolvedValue([baseVariant()] as never);
    prismaMock.client.findFirst.mockResolvedValue(null);

    const result = await createSale({
      clientId: "client-from-another-boutique",
      discount: 0,
      paymentMethod: null,
      items: [{ variantId: "variant-1", quantity: 1 }],
    });

    expect(result.error).toBe("invalid");
    expect(prismaMock.client.findFirst).toHaveBeenCalledWith({
      where: { id: "client-from-another-boutique", productType: "cosmetique" },
    });
  });

  it("rejects when a variant has insufficient stock", async () => {
    prismaMock.productVariant.findMany.mockResolvedValue([
      baseVariant({ stock: 1 }),
    ] as never);

    const result = await createSale({
      clientId: null,
      discount: 0,
      paymentMethod: null,
      items: [{ variantId: "variant-1", quantity: 5 }],
    });

    expect(result.error).toBe("insufficientStock");
    expect(prismaMock.productVariant.updateMany).not.toHaveBeenCalled();
  });

  it("rejects when the atomic stock guard loses a race despite the initial read passing", async () => {
    // Simulates two concurrent sales/orders for the same variant: the read
    // above sees enough stock, but by the time this transaction's UPDATE
    // runs, someone else's already claimed it — the WHERE guard (stock >=
    // quantity) matches no row instead of driving stock negative.
    prismaMock.productVariant.findMany.mockResolvedValue([
      baseVariant({ stock: 5 }),
    ] as never);
    prismaMock.productVariant.updateMany.mockResolvedValue({ count: 0 } as never);

    const result = await createSale({
      clientId: null,
      discount: 0,
      paymentMethod: null,
      items: [{ variantId: "variant-1", quantity: 5 }],
    });

    expect(result.error).toBe("insufficientStock");
    expect(prismaMock.sale.create).not.toHaveBeenCalled();
  });

  it("retries the sale reference on a collision then succeeds", async () => {
    prismaMock.productVariant.findMany.mockResolvedValue([baseVariant()] as never);
    prismaMock.productVariant.updateMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.sale.create
      .mockRejectedValueOnce(collisionError())
      .mockResolvedValueOnce({ id: "sale-2" } as never);

    const result = await createSale({
      clientId: null,
      discount: 0,
      paymentMethod: null,
      items: [{ variantId: "variant-1", quantity: 1 }],
    });

    expect(result.saleId).toBe("sale-2");
    expect(prismaMock.sale.create).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid input before touching the database", async () => {
    const result = await createSale({
      clientId: null,
      discount: 0,
      paymentMethod: null,
      items: [],
    });

    expect(result.error).toBe("invalid");
    expect(prismaMock.productVariant.findMany).not.toHaveBeenCalled();
  });
});

describe("cancelSale", () => {
  function completedSale(overrides: Record<string, unknown> = {}) {
    return {
      id: "sale-1",
      reference: "VNT-1",
      clientId: null,
      loyaltyPointsEarned: 0,
      loyaltyPointsRedeemed: 0,
      items: [
        { variantId: "variant-1", quantity: 2 },
        { variantId: "variant-2", quantity: 1 },
      ],
      ...overrides,
    };
  }

  it("restores stock and marks the sale cancelled", async () => {
    prismaMock.sale.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.sale.findUniqueOrThrow.mockResolvedValue(completedSale() as never);
    prismaMock.productVariant.update.mockResolvedValue({} as never);

    const result = await cancelSale({ saleId: "sale-1", reason: "Erreur de caisse" });

    expect(result.error).toBeUndefined();
    expect(prismaMock.sale.updateMany).toHaveBeenCalledWith({
      where: { id: "sale-1", productType: "cosmetique", status: "COMPLETED" },
      data: { status: "CANCELLED" },
    });
    expect(prismaMock.productVariant.update).toHaveBeenCalledWith({
      where: { id: "variant-1" },
      data: { stock: { increment: 2 } },
    });
    expect(prismaMock.productVariant.update).toHaveBeenCalledTimes(2);
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    expect(prismaMock.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "sale.cancel",
        targetId: "sale-1",
        targetLabel: "VNT-1",
        oldValue: { status: "COMPLETED" },
        newValue: { status: "CANCELLED", restockedItems: 3, loyaltyPointsChange: 0 },
        reason: "Erreur de caisse",
      }),
    });
  });

  it("refuses a cancellation without a reason", async () => {
    expect((await cancelSale({ saleId: "sale-1", reason: " " })).error).toBe("invalid");
    expect((await cancelSale({ saleId: "sale-1" })).error).toBe("invalid");
    expect(prismaMock.sale.updateMany).not.toHaveBeenCalled();
  });

  it("flags in the history a sale cancelled after its till was closed", async () => {
    prismaMock.sale.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.sale.findUniqueOrThrow.mockResolvedValue(
      completedSale({ cashSession: { status: "CLOSED" } }) as never,
    );
    prismaMock.productVariant.update.mockResolvedValue({} as never);

    await cancelSale({ saleId: "sale-1", reason: "Erreur de caisse" });

    expect(prismaMock.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        newValue: expect.objectContaining({ closedTill: true }),
      }),
    });
  });

  it("returns notFound for a sale outside the admin's boutique", async () => {
    prismaMock.sale.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.sale.findFirst.mockResolvedValue(null);

    const result = await cancelSale({ saleId: "sale-from-another-boutique", reason: "Erreur de caisse" });

    expect(result.error).toBe("notFound");
    expect(prismaMock.productVariant.update).not.toHaveBeenCalled();
  });

  it("returns alreadyCancelled without touching stock twice", async () => {
    prismaMock.sale.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.sale.findFirst.mockResolvedValue({ status: "CANCELLED" } as never);

    const result = await cancelSale({ saleId: "sale-1", reason: "Erreur de caisse" });

    expect(result.error).toBe("alreadyCancelled");
    expect(prismaMock.productVariant.update).not.toHaveBeenCalled();
    expect(prismaMock.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it("refuses to cancel a sale that was (partly) refunded", async () => {
    prismaMock.sale.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.sale.findFirst.mockResolvedValue({ status: "PARTIALLY_REFUNDED" } as never);

    expect((await cancelSale({ saleId: "sale-1", reason: "Erreur de caisse" })).error).toBe("refunded");
    expect(prismaMock.productVariant.update).not.toHaveBeenCalled();
  });

  it("refuses to cancel while a refund request is pending", async () => {
    prismaMock.sale.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.refundRequest.findFirst.mockResolvedValue({ id: "request-1" } as never);

    expect((await cancelSale({ saleId: "sale-1", reason: "Erreur de caisse" })).error).toBe("pendingRefund");
    expect(prismaMock.productVariant.update).not.toHaveBeenCalled();
  });

  it("takes back earned points and gives back redeemed ones", async () => {
    prismaMock.sale.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.sale.findUniqueOrThrow.mockResolvedValue(
      completedSale({ clientId: "client-1", loyaltyPointsEarned: 5, loyaltyPointsRedeemed: 100 }) as never,
    );
    prismaMock.productVariant.update.mockResolvedValue({} as never);
    prismaMock.$queryRaw.mockResolvedValue([{ loyaltyPoints: 12 }] as never);
    prismaMock.client.update.mockResolvedValue({} as never);

    await cancelSale({ saleId: "sale-1", reason: "Erreur de caisse" });

    expect(prismaMock.client.update).toHaveBeenCalledWith({
      where: { id: "client-1" },
      data: { loyaltyPoints: 107 },
    });
  });

  it("never drives the balance below zero when the earned points were already spent", async () => {
    prismaMock.sale.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.sale.findUniqueOrThrow.mockResolvedValue(
      completedSale({ clientId: "client-1", loyaltyPointsEarned: 30 }) as never,
    );
    prismaMock.productVariant.update.mockResolvedValue({} as never);
    prismaMock.$queryRaw.mockResolvedValue([{ loyaltyPoints: 10 }] as never);
    prismaMock.client.update.mockResolvedValue({} as never);

    await cancelSale({ saleId: "sale-1", reason: "Erreur de caisse" });

    expect(prismaMock.client.update).toHaveBeenCalledWith({
      where: { id: "client-1" },
      data: { loyaltyPoints: 0 },
    });
  });
});

describe("updateSale", () => {
  function recordedSale(overrides: Record<string, unknown> = {}) {
    prismaMock.sale.findUniqueOrThrow.mockResolvedValue({
      id: "sale-1",
      reference: "VNT-1",
      status: "COMPLETED",
      paymentMethod: "cash",
      walletProvider: null,
      clientId: null,
      client: null,
      notes: null,
      loyaltyPointsEarned: 0,
      loyaltyPointsRedeemed: 0,
      cashSession: { status: "OPEN" },
      refundRequests: [],
      ...overrides,
    } as never);
  }

  const TO_WALLET = {
    saleId: "sale-1",
    paymentMethod: "wallet",
    walletAccountId: "wallet-1",
    clientId: null,
    notes: "",
    reason: "Mauvais moyen choisi",
  };

  it("never lets a seller edit a sale", async () => {
    prismaMock.adminUser.findUnique.mockResolvedValue({
      id: "seller-1",
      supabaseUserId: "admin-1",
      role: "SELLER",
      productType: "cosmetique",
      createdAt: new Date(),
    } as never);

    await expect(updateSale(TO_WALLET)).rejects.toThrow("forbidden");
    expect(prismaMock.sale.update).not.toHaveBeenCalled();
  });

  it("corrects the payment and keeps the old and new value with the reason", async () => {
    recordedSale();
    prismaMock.walletAccount.findFirst.mockResolvedValue({ provider: "Bankily" } as never);

    expect(await updateSale(TO_WALLET)).toEqual({});
    expect(prismaMock.walletAccount.findFirst).toHaveBeenCalledWith({
      where: { id: "wallet-1", productType: "cosmetique" },
      select: { provider: true },
    });
    expect(prismaMock.sale.update).toHaveBeenCalledWith({
      where: { id: "sale-1" },
      data: {
        paymentMethod: "wallet",
        walletProvider: "Bankily",
        clientId: null,
        notes: null,
        amountReceived: null,
      },
    });
    expect(prismaMock.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "sale.update",
        targetLabel: "VNT-1",
        oldValue: { paymentMethod: "cash", walletProvider: null },
        newValue: { paymentMethod: "wallet", walletProvider: "Bankily" },
        reason: "Mauvais moyen choisi",
      }),
    });
  });

  it("ignores any other field sent along — items and amounts never change", async () => {
    recordedSale();
    prismaMock.walletAccount.findFirst.mockResolvedValue({ provider: "Bankily" } as never);

    await updateSale({ ...TO_WALLET, total: 1, discount: 999, items: [], status: "CANCELLED" });

    const { data } = prismaMock.sale.update.mock.calls[0][0];
    expect(Object.keys(data).sort()).toEqual(
      ["amountReceived", "clientId", "notes", "paymentMethod", "walletProvider"].sort(),
    );
  });

  it("refuses a wallet or a client of another boutique", async () => {
    recordedSale();
    prismaMock.walletAccount.findFirst.mockResolvedValue(null);

    expect(await updateSale(TO_WALLET)).toEqual({ error: "invalid" });

    prismaMock.client.findFirst.mockResolvedValue(null);
    expect(
      await updateSale({
        saleId: "sale-1",
        paymentMethod: "cash",
        clientId: "other-boutique-client",
        reason: "Client oublié",
      }),
    ).toEqual({ error: "invalid" });
    expect(prismaMock.sale.update).not.toHaveBeenCalled();
  });

  it("refuses a sale of another boutique", async () => {
    prismaMock.$queryRaw.mockResolvedValue([] as never);

    expect(await updateSale(TO_WALLET)).toEqual({ error: "notFound" });
  });

  it("requires a reason", async () => {
    expect(await updateSale({ ...TO_WALLET, reason: " " })).toEqual({ error: "invalid" });
  });

  it("flags a change on a sale whose till is already closed", async () => {
    recordedSale({ cashSession: { status: "CLOSED" } });
    prismaMock.walletAccount.findFirst.mockResolvedValue({ provider: "Bankily" } as never);

    await updateSale(TO_WALLET);

    expect(prismaMock.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        newValue: expect.objectContaining({ closedTill: true }),
      }),
    });
  });

  it("keeps the payment once a refund went back by it", async () => {
    recordedSale({ refundRequests: [{ id: "request-1" }] });
    prismaMock.walletAccount.findFirst.mockResolvedValue({ provider: "Bankily" } as never);

    expect(await updateSale(TO_WALLET)).toEqual({ error: "paymentLocked" });
  });

  it("keeps the client once loyalty points are tied to them", async () => {
    recordedSale({ clientId: "client-1", loyaltyPointsEarned: 12 });
    prismaMock.client.findFirst.mockResolvedValue({ fullName: "Autre" } as never);

    expect(
      await updateSale({
        saleId: "sale-1",
        paymentMethod: "cash",
        clientId: "client-2",
        reason: "Mauvais client",
      }),
    ).toEqual({ error: "clientLocked" });
  });

  it("keeps a payment the form can't offer when only the note changes", async () => {
    recordedSale({ paymentMethod: "card" });

    expect(
      await updateSale({ saleId: "sale-1", clientId: null, notes: "Payé par carte", reason: "Note" }),
    ).toEqual({});
    expect(prismaMock.sale.update).toHaveBeenCalledWith({
      where: { id: "sale-1" },
      data: { paymentMethod: "card", walletProvider: null, clientId: null, notes: "Payé par carte" },
    });
    expect(prismaMock.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ oldValue: { notes: null }, newValue: { notes: "Payé par carte" } }),
    });
  });

  it("refuses a cancelled sale, and an edit that changes nothing", async () => {
    recordedSale({ status: "CANCELLED" });
    expect(await updateSale({ ...TO_WALLET })).toEqual({ error: "notEditable" });

    recordedSale();
    expect(
      await updateSale({ saleId: "sale-1", paymentMethod: "cash", clientId: null, reason: "Rien" }),
    ).toEqual({ error: "noChanges" });
  });
});
