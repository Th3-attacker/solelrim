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
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "auth-1" } } }) },
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

function activeLicense() {
  prismaMock.storeType.findUnique.mockResolvedValue({
    licenseType: "MONTHLY",
    licenseStatus: "ACTIVE",
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

beforeEach(() => {
  mockReset(prismaMock);
  createClientMock.mockReset();
  prismaMock.$transaction.mockImplementation((cb) =>
    (cb as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock),
  );
  activeLicense();
});

describe("createPosSale", () => {
  it("lets a SELLER record a cash sale, stamped with who made it", async () => {
    signedInAs("SELLER");
    stockedVariant();

    const result = await createPosSale({
      paymentMethod: "cash",
      items: ITEMS,
      discount: 0,
      amountReceived: 1500,
    });

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

  it("prices from the database, ignoring any price the client sends", async () => {
    signedInAs("SELLER");
    stockedVariant();

    await createPosSale({
      paymentMethod: "cash",
      items: [{ variantId: "variant-1", quantity: 2, unitPrice: 1 }],
      discount: 0,
      amountReceived: null,
    });

    expect(prismaMock.sale.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ subtotal: 1000, total: 1000 }),
    });
  });

  it("refuses a cash amount below the server-computed total and rolls back", async () => {
    signedInAs("SELLER");
    stockedVariant();

    const result = await createPosSale({
      paymentMethod: "cash",
      items: ITEMS,
      discount: 0,
      amountReceived: 900,
    });

    expect(result.error).toBe("insufficientAmount");
    expect(prismaMock.sale.create).not.toHaveBeenCalled();
  });

  it("records the wallet provider as a snapshot for a wallet sale", async () => {
    signedInAs("SELLER");
    stockedVariant();
    prismaMock.walletAccount.findFirst.mockResolvedValue({ provider: "Bankily" } as never);

    const result = await createPosSale({
      paymentMethod: "wallet",
      items: ITEMS,
      discount: 0,
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

    const result = await createPosSale({
      paymentMethod: "cash",
      items: ITEMS,
      discount: 0,
      amountReceived: null,
    });

    expect(result.error).toBe("invalid");
    expect(prismaMock.sale.create).not.toHaveBeenCalled();
  });

  it("rejects a wallet sale that names no wallet account", async () => {
    signedInAs("SELLER");

    const result = await createPosSale({ paymentMethod: "wallet", items: ITEMS, discount: 0 });

    expect(result.error).toBe("invalid");
    expect(prismaMock.productVariant.findMany).not.toHaveBeenCalled();
  });

  it("is blocked when the boutique's license is suspended", async () => {
    signedInAs("SELLER");
    prismaMock.storeType.findUnique.mockResolvedValue({
      licenseType: "MONTHLY",
      licenseStatus: "SUSPENDED",
      licenseExpiresAt: null,
    } as never);

    await expect(
      createPosSale({ paymentMethod: "cash", items: ITEMS, discount: 0, amountReceived: null }),
    ).rejects.toThrow("licenseBlocked");
    expect(prismaMock.sale.create).not.toHaveBeenCalled();
  });

  it("rejects a caller who isn't signed in", async () => {
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });

    await expect(
      createPosSale({ paymentMethod: "cash", items: ITEMS, discount: 0, amountReceived: null }),
    ).rejects.toThrow("unauthorized");
  });
});
