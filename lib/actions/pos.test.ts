import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/lib/generated/prisma/client";

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
import { createPosSale } from "@/lib/actions/pos";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const createClientMock = createClient as unknown as Mock;

function decimal(value: number) {
  return { toNumber: () => value };
}

function signedInAs(role: "BOUTIQUE_ADMIN" | "SELLER") {
  createClientMock.mockResolvedValue({
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: { id: "auth-1", email: "amina@shop.mr" } } }),
    },
  });
  prismaMock.adminUser.findUnique.mockResolvedValue({
    id: "seller-1",
    supabaseUserId: "auth-1",
    role,
    productType: "cosmetique",
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

// 2 × 500 MRU = 1 000 MRU subtotal.
function stockedVariant(overrides: Partial<Record<string, unknown>> = {}) {
  prismaMock.productVariant.findMany.mockResolvedValue([
    {
      id: "variant-1",
      stock: 10,
      price: null,
      product: { productType: "cosmetique", basePrice: decimal(500) },
      ...overrides,
    },
  ] as never);
  prismaMock.productVariant.updateMany.mockResolvedValue({ count: 1 } as never);
  prismaMock.sale.create.mockResolvedValue({ id: "sale-1" } as never);
}

const ITEMS = [{ variantId: "variant-1", quantity: 2 }];
const CASH = { paymentMethod: "cash", items: ITEMS, discount: 0, expectedTotal: 1000 } as const;

beforeEach(() => {
  mockReset(prismaMock);
  createClientMock.mockReset();
  prismaMock.$transaction.mockImplementation((cb) =>
    (cb as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock),
  );
  license("ACTIVE");
});

describe("createPosSale", () => {
  it("lets a SELLER record a cash sale, stamped with who made it", async () => {
    signedInAs("SELLER");
    stockedVariant();

    const result = await createPosSale({ ...CASH, amountReceived: 1500 });

    expect(result.error).toBeUndefined();
    expect(result.total).toBe(1000);
    expect(result.change).toBe(500);
    expect(prismaMock.sale.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productType: "cosmetique",
        sellerId: "seller-1",
        paymentMethod: "cash",
        amountReceived: 1500,
        walletProvider: null,
        total: 1000,
      }),
    });
  });

  it("writes the sale's audit entry in the same transaction, naming the seller and their role", async () => {
    signedInAs("SELLER");
    stockedVariant();

    await createPosSale({ ...CASH, amountReceived: 1500 });

    expect(prismaMock.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminUserId: "seller-1",
        adminEmail: "amina@shop.mr",
        adminRole: "SELLER",
        productType: "cosmetique",
        action: "sale.create",
        targetId: "sale-1",
        newValue: expect.objectContaining({ channel: "pos", total: 1000, paymentMethod: "cash" }),
      }),
    });
  });

  it("fails the sale when its audit entry can't be written, so no untraced sale commits", async () => {
    signedInAs("SELLER");
    stockedVariant();
    prismaMock.adminAuditLog.create.mockRejectedValue(new Error("db down"));

    await expect(createPosSale({ ...CASH, amountReceived: null })).rejects.toThrow("db down");
  });

  it("leaves no audit entry for a refused sale", async () => {
    signedInAs("SELLER");
    stockedVariant();

    await createPosSale({ ...CASH, amountReceived: 900 });

    expect(prismaMock.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it("prices from the database, ignoring any price the client sends", async () => {
    signedInAs("SELLER");
    stockedVariant();

    await createPosSale({
      ...CASH,
      items: [{ variantId: "variant-1", quantity: 2, unitPrice: 1 }],
      amountReceived: null,
    });

    expect(prismaMock.sale.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ subtotal: 1000, total: 1000 }),
    });
  });

  it("refuses when a price changed since the screen loaded, instead of recording a different total", async () => {
    signedInAs("SELLER");
    stockedVariant();

    // The seller's screen still showed 900; the database now says 1 000.
    const result = await createPosSale({ ...CASH, expectedTotal: 900, amountReceived: null });

    expect(result.error).toBe("totalChanged");
    expect(prismaMock.sale.create).not.toHaveBeenCalled();
  });

  it("refuses a cash amount below the server-computed total and rolls back", async () => {
    signedInAs("SELLER");
    stockedVariant();

    const result = await createPosSale({ ...CASH, amountReceived: 900 });

    expect(result.error).toBe("insufficientAmount");
    expect(prismaMock.sale.create).not.toHaveBeenCalled();
  });

  it("refuses an amount too large for the money columns before touching the database", async () => {
    signedInAs("SELLER");

    const result = await createPosSale({ ...CASH, amountReceived: 1e11 });

    expect(result.error).toBe("invalid");
    expect(prismaMock.productVariant.findMany).not.toHaveBeenCalled();
  });

  it("records the wallet provider as a snapshot for a wallet sale", async () => {
    signedInAs("SELLER");
    stockedVariant();
    prismaMock.walletAccount.findFirst.mockResolvedValue({ provider: "Bankily" } as never);

    const result = await createPosSale({
      paymentMethod: "wallet",
      items: ITEMS,
      discount: 0,
      expectedTotal: 1000,
      walletAccountId: "wallet-1",
    });

    expect(result.error).toBeUndefined();
    expect(result.change).toBeUndefined();
    expect(prismaMock.sale.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        paymentMethod: "wallet",
        walletProvider: "Bankily",
        amountReceived: null,
      }),
    });
  });

  it("rejects a wallet account from another boutique", async () => {
    signedInAs("SELLER");
    stockedVariant();
    prismaMock.walletAccount.findFirst.mockResolvedValue(null);

    const result = await createPosSale({
      paymentMethod: "wallet",
      items: ITEMS,
      discount: 0,
      expectedTotal: 1000,
      walletAccountId: "other-boutique-wallet",
    });

    expect(result.error).toBe("invalid");
    expect(prismaMock.walletAccount.findFirst).toHaveBeenCalledWith({
      where: { id: "other-boutique-wallet", productType: "cosmetique" },
      select: { provider: true },
    });
    expect(prismaMock.sale.create).not.toHaveBeenCalled();
  });

  it("rejects a variant from another boutique", async () => {
    signedInAs("SELLER");
    stockedVariant({ product: { productType: "sport", basePrice: decimal(500) } });

    const result = await createPosSale({ ...CASH, amountReceived: null });

    expect(result.error).toBe("invalid");
    expect(prismaMock.sale.create).not.toHaveBeenCalled();
  });

  it("rejects a wallet sale that names no wallet account", async () => {
    signedInAs("SELLER");

    const result = await createPosSale({
      paymentMethod: "wallet",
      items: ITEMS,
      discount: 0,
      expectedTotal: 1000,
    });

    expect(result.error).toBe("invalid");
    expect(prismaMock.productVariant.findMany).not.toHaveBeenCalled();
  });

  // Returned, not thrown: Next masks a thrown action's message in
  // production, and the checkout must tell these two apart.
  it("reports licenseBlocked when the boutique's license is suspended", async () => {
    signedInAs("SELLER");
    license("SUSPENDED");

    const result = await createPosSale({ ...CASH, amountReceived: null });

    expect(result.error).toBe("licenseBlocked");
    expect(prismaMock.sale.create).not.toHaveBeenCalled();
  });

  it("reports unauthorized for a caller who isn't signed in", async () => {
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });

    const result = await createPosSale({ ...CASH, amountReceived: null });

    expect(result.error).toBe("unauthorized");
    expect(prismaMock.sale.create).not.toHaveBeenCalled();
  });
});

describe("createPosSale with a loyalty card", () => {
  // 1 point per 100 MRU; 100 points = 300 MRU off.
  function loyaltyBoutique(overrides: Record<string, unknown> = {}) {
    prismaMock.storeType.findUnique.mockResolvedValue({
      licenseType: "MONTHLY",
      licenseStatus: "ACTIVE",
      licenseExpiresAt: null,
      loyaltyEnabled: true,
      loyaltySpendPerPoint: 100,
      loyaltyRewardPoints: 100,
      loyaltyRewardValue: 300,
      ...overrides,
    } as never);
  }

  function enrolledCard(balanceAfter: number) {
    prismaMock.client.findFirst.mockResolvedValue({ id: "client-1" } as never);
    prismaMock.client.update.mockResolvedValue({ loyaltyPoints: balanceAfter } as never);
  }

  it("attaches the sale to the card and earns points on the total", async () => {
    signedInAs("SELLER");
    loyaltyBoutique();
    stockedVariant();
    enrolledCard(15);

    const result = await createPosSale({
      ...CASH,
      amountReceived: null,
      loyalty: { clientId: "client-1", redeem: false },
    });

    expect(result.error).toBeUndefined();
    expect(result.loyaltyPointsEarned).toBe(10);
    expect(result.loyaltyPointsBalance).toBe(15);
    expect(prismaMock.client.update).toHaveBeenCalledWith({
      where: { id: "client-1" },
      data: { loyaltyPoints: { increment: 10 } },
      select: { loyaltyPoints: true },
    });
    expect(prismaMock.sale.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clientId: "client-1",
        loyaltyPointsEarned: 10,
        loyaltyPointsRedeemed: 0,
        loyaltyDiscount: 0,
        total: 1000,
      }),
    });
  });

  it("spends one reward atomically and earns only on what was actually paid", async () => {
    signedInAs("SELLER");
    loyaltyBoutique();
    stockedVariant();
    enrolledCard(7);
    prismaMock.client.updateMany.mockResolvedValue({ count: 1 });

    const result = await createPosSale({
      ...CASH,
      expectedTotal: 700,
      amountReceived: 700,
      loyalty: { clientId: "client-1", redeem: true },
    });

    expect(result.error).toBeUndefined();
    expect(prismaMock.client.updateMany).toHaveBeenCalledWith({
      where: { id: "client-1", loyaltyPoints: { gte: 100 } },
      data: { loyaltyPoints: { decrement: 100 } },
    });
    expect(prismaMock.sale.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        loyaltyDiscount: 300,
        loyaltyPointsRedeemed: 100,
        loyaltyPointsEarned: 7,
        total: 700,
      }),
    });
  });

  it("never discounts below zero, however large the reward", async () => {
    signedInAs("SELLER");
    loyaltyBoutique({ loyaltyRewardValue: 5000 });
    stockedVariant();
    enrolledCard(0);
    prismaMock.client.updateMany.mockResolvedValue({ count: 1 });

    const result = await createPosSale({
      ...CASH,
      expectedTotal: 0,
      amountReceived: null,
      loyalty: { clientId: "client-1", redeem: true },
    });

    expect(result.error).toBeUndefined();
    expect(prismaMock.sale.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ loyaltyDiscount: 1000, total: 0, loyaltyPointsEarned: 0 }),
    });
  });

  it("spends no points when a manual discount already brought the total to zero", async () => {
    signedInAs("SELLER");
    loyaltyBoutique();
    stockedVariant();
    enrolledCard(150);

    const result = await createPosSale({
      ...CASH,
      discount: 1000,
      expectedTotal: 0,
      amountReceived: null,
      loyalty: { clientId: "client-1", redeem: true },
    });

    expect(result.error).toBeUndefined();
    expect(prismaMock.client.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.sale.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ loyaltyDiscount: 0, loyaltyPointsRedeemed: 0, total: 0 }),
    });
  });

  it("refuses the sale when the points were spent elsewhere in the meantime", async () => {
    signedInAs("SELLER");
    loyaltyBoutique();
    stockedVariant();
    enrolledCard(0);
    prismaMock.client.updateMany.mockResolvedValue({ count: 0 });

    const result = await createPosSale({
      ...CASH,
      expectedTotal: 700,
      amountReceived: null,
      loyalty: { clientId: "client-1", redeem: true },
    });

    expect(result.error).toBe("insufficientPoints");
    expect(prismaMock.sale.create).not.toHaveBeenCalled();
  });

  it("rejects a card that isn't enrolled in this boutique", async () => {
    signedInAs("SELLER");
    loyaltyBoutique();
    stockedVariant();
    prismaMock.client.findFirst.mockResolvedValue(null);

    const result = await createPosSale({
      ...CASH,
      amountReceived: null,
      loyalty: { clientId: "client-elsewhere", redeem: false },
    });

    expect(result.error).toBe("invalid");
    expect(prismaMock.client.findFirst).toHaveBeenCalledWith({
      where: { id: "client-elsewhere", productType: "cosmetique", loyaltyEnrolledAt: { not: null } },
      select: { id: true },
    });
    expect(prismaMock.sale.create).not.toHaveBeenCalled();
  });

  it("rejects a card once the boutique switched loyalty off", async () => {
    signedInAs("SELLER");
    loyaltyBoutique({ loyaltyEnabled: false });
    stockedVariant();
    enrolledCard(0);

    const result = await createPosSale({
      ...CASH,
      amountReceived: null,
      loyalty: { clientId: "client-1", redeem: false },
    });

    expect(result.error).toBe("invalid");
    expect(prismaMock.sale.create).not.toHaveBeenCalled();
  });
});
