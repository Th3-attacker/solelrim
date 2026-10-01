import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/lib/generated/prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReceipt } from "@/lib/queries/pos";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const createAdminClientMock = createAdminClient as unknown as Mock;

function decimal(value: number) {
  return { toNumber: () => value };
}

function sale(overrides: Record<string, unknown> = {}) {
  return {
    reference: "VNT-1",
    createdAt: new Date("2026-09-30T10:00:00Z"),
    status: "COMPLETED",
    subtotal: decimal(1000),
    discount: decimal(0),
    loyaltyDiscount: decimal(0),
    loyaltyPointsEarned: 0,
    total: decimal(1000),
    paymentMethod: "cash",
    walletProvider: null,
    amountReceived: decimal(1500),
    seller: { supabaseUserId: "seller-auth-1", role: "SELLER" },
    client: null,
    storeType: {
      label: "Sport",
      siteName: null,
      siteNameAr: null,
      siteNameEn: null,
      adminWhatsappNumber: null,
      logoStoragePath: null,
    },
    items: [
      {
        quantity: 2,
        unitPrice: decimal(500),
        lineTotal: decimal(1000),
        variant: { size: "M", color: "Noir", product: { name: "T-shirt" } },
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  mockReset(prismaMock);
  createAdminClientMock.mockReset();
  createAdminClientMock.mockReturnValue({
    auth: {
      admin: {
        getUserById: vi
          .fn()
          .mockResolvedValue({ data: { user: { email: "amina@boutique.example" } } }),
      },
    },
  });
});

describe("getReceipt", () => {
  it("only looks the sale up inside the caller's boutique", async () => {
    prismaMock.sale.findFirst.mockResolvedValue(null);

    const receipt = await getReceipt("sale-from-another-boutique", "sport");

    expect(receipt).toBeNull();
    expect(prismaMock.sale.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "sale-from-another-boutique", productType: "sport" } }),
    );
  });

  it("shows only the part of the seller's email before @", async () => {
    prismaMock.sale.findFirst.mockResolvedValue(sale() as never);

    const receipt = await getReceipt("sale-1", "sport");

    expect(receipt?.sellerLabel).toBe("amina");
  });

  it("never names a boutique admin or superadmin on a customer receipt", async () => {
    prismaMock.sale.findFirst.mockResolvedValue(
      sale({ seller: { supabaseUserId: "admin-auth-1", role: "SUPERADMIN" } }) as never,
    );

    const receipt = await getReceipt("sale-1", "sport");

    expect(receipt?.sellerLabel).toBeNull();
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("has no seller for a sale created from an online order", async () => {
    prismaMock.sale.findFirst.mockResolvedValue(sale({ seller: null }) as never);

    const receipt = await getReceipt("sale-1", "sport");

    expect(receipt?.sellerLabel).toBeNull();
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("converts money columns to plain numbers for rendering", async () => {
    prismaMock.sale.findFirst.mockResolvedValue(sale() as never);

    const receipt = await getReceipt("sale-1", "sport");

    expect(receipt?.total).toBe(1000);
    expect(receipt?.amountReceived).toBe(1500);
    expect(receipt?.lines[0]).toEqual({
      productName: "T-shirt",
      size: "M",
      color: "Noir",
      quantity: 2,
      unitPrice: 500,
      lineTotal: 1000,
    });
  });

  it("carries the loyalty reward and the card's number for the WhatsApp form", async () => {
    prismaMock.sale.findFirst.mockResolvedValue(
      sale({
        loyaltyDiscount: decimal(200),
        loyaltyPointsEarned: 8,
        client: { phone: "22123456" },
      }) as never,
    );

    const receipt = await getReceipt("sale-1", "sport");

    expect(receipt?.loyaltyDiscount).toBe(200);
    expect(receipt?.loyaltyPointsEarned).toBe(8);
    expect(receipt?.clientPhone).toBe("22123456");
  });
});
