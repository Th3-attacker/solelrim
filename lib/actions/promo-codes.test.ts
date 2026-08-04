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
vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import {
  createPromoCode,
  deactivatePromoCode,
  previewPromoCode,
} from "@/lib/actions/promo-codes";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const createClientMock = createClient as unknown as Mock;
const headersMock = headers as unknown as Mock;

function decimal(value: number) {
  return { toNumber: () => value };
}

function collisionError() {
  return new PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

// Mirrors lib/actions/orders.test.ts: requireAdminScope() resolves straight
// from this AdminUser row for a BOUTIQUE_ADMIN, no cookies()/getStoreTypes()
// lookups needed.
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

beforeEach(() => {
  mockReset(prismaMock);
  createClientMock.mockReset();
  headersMock.mockReset();
  headersMock.mockResolvedValue({ get: () => null });
  prismaMock.rateLimitHit.count.mockResolvedValue(0);
  asAdmin();
});

describe("createPromoCode", () => {
  const validInput = {
    code: "welcome10",
    discountType: "PERCENT" as const,
    discountValue: 10,
    clientId: null,
    expiresAt: null,
    maxUses: null,
  };

  it("creates a general code, uppercased, scoped to the admin's boutique", async () => {
    prismaMock.promoCode.create.mockResolvedValue({ id: "promo-1" } as never);

    const result = await createPromoCode(validInput);

    expect(result.error).toBeUndefined();
    expect(prismaMock.promoCode.create).toHaveBeenCalledWith({
      data: {
        code: "WELCOME10",
        discountType: "PERCENT",
        discountValue: 10,
        clientId: null,
        productType: "cosmetique",
        expiresAt: null,
        maxUses: null,
      },
    });
  });

  it("rejects a client outside the admin's boutique", async () => {
    prismaMock.client.findFirst.mockResolvedValue(null);

    const result = await createPromoCode({
      ...validInput,
      clientId: "client-from-another-boutique",
    });

    expect(result.error).toBe("invalid");
    expect(prismaMock.promoCode.create).not.toHaveBeenCalled();
  });

  it("creates a personal code once the client is confirmed in scope", async () => {
    prismaMock.client.findFirst.mockResolvedValue({ id: "client-1" } as never);
    prismaMock.promoCode.create.mockResolvedValue({ id: "promo-2" } as never);

    const result = await createPromoCode({ ...validInput, clientId: "client-1" });

    expect(result.error).toBeUndefined();
    expect(prismaMock.client.findFirst).toHaveBeenCalledWith({
      where: { id: "client-1", productType: "cosmetique" },
      select: { id: true },
    });
  });

  it("rejects a percentage discount over 100", async () => {
    const result = await createPromoCode({ ...validInput, discountValue: 150 });

    expect(result.error).toBe("invalid");
    expect(prismaMock.promoCode.create).not.toHaveBeenCalled();
  });

  it("reports a duplicate code collision", async () => {
    prismaMock.promoCode.create.mockRejectedValue(collisionError());

    const result = await createPromoCode(validInput);

    expect(result.error).toBe("duplicateCode");
  });
});

describe("deactivatePromoCode", () => {
  it("deactivates a code scoped to the admin's boutique", async () => {
    prismaMock.promoCode.updateMany.mockResolvedValue({ count: 1 } as never);

    const result = await deactivatePromoCode("promo-1");

    expect(result.error).toBeUndefined();
    expect(prismaMock.promoCode.updateMany).toHaveBeenCalledWith({
      where: { id: "promo-1", productType: "cosmetique" },
      data: { isActive: false },
    });
  });

  it("returns notFound for a code outside the admin's boutique", async () => {
    prismaMock.promoCode.updateMany.mockResolvedValue({ count: 0 } as never);

    const result = await deactivatePromoCode("promo-from-another-boutique");

    expect(result.error).toBe("notFound");
  });
});

describe("previewPromoCode", () => {
  const baseCode = {
    id: "promo-1",
    isActive: true,
    productType: "cosmetique",
    discountType: "PERCENT" as const,
    discountValue: decimal(10),
    expiresAt: null,
    maxUses: null,
    usedCount: 0,
    clientId: null,
    client: null,
  };

  it("returns the computed discount for a valid code", async () => {
    prismaMock.promoCode.findUnique.mockResolvedValue(baseCode as never);

    const result = await previewPromoCode({
      code: "welcome10",
      productType: "cosmetique",
      customerPhone: "22345678",
      subtotal: 2000,
    });

    expect(result).toEqual({
      discountType: "PERCENT",
      discountValue: 10,
      discount: 200,
    });
  });

  it("does not touch usedCount — it's read-only", async () => {
    prismaMock.promoCode.findUnique.mockResolvedValue(baseCode as never);

    await previewPromoCode({
      code: "welcome10",
      productType: "cosmetique",
      customerPhone: "22345678",
      subtotal: 2000,
    });

    expect(prismaMock.promoCode.update).not.toHaveBeenCalled();
  });

  it("returns notFound for an unknown code", async () => {
    prismaMock.promoCode.findUnique.mockResolvedValue(null);

    const result = await previewPromoCode({
      code: "GHOST",
      productType: "cosmetique",
      customerPhone: "22345678",
      subtotal: 2000,
    });

    expect(result).toEqual({ error: "notFound" });
  });

  it("returns usageLimitReached once maxUses is hit", async () => {
    prismaMock.promoCode.findUnique.mockResolvedValue({
      ...baseCode,
      maxUses: 1,
      usedCount: 1,
    } as never);

    const result = await previewPromoCode({
      code: "welcome10",
      productType: "cosmetique",
      customerPhone: "22345678",
      subtotal: 2000,
    });

    expect(result).toEqual({ error: "usageLimitReached" });
  });

  it("is rate limited per IP", async () => {
    prismaMock.rateLimitHit.count.mockResolvedValue(20);

    const result = await previewPromoCode({
      code: "welcome10",
      productType: "cosmetique",
      customerPhone: "22345678",
      subtotal: 2000,
    });

    expect(result).toEqual({ error: "rateLimited" });
    expect(prismaMock.promoCode.findUnique).not.toHaveBeenCalled();
  });
});
