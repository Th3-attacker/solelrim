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
import { createSale, cancelSale } from "@/lib/actions/sales";

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
  createClientMock.mockReset();
  revalidatePathMock.mockReset();
  asAdmin();
  prismaMock.$transaction.mockImplementation((cb) =>
    (cb as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock),
  );
});

describe("createSale", () => {
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
        data: expect.objectContaining({ productType: "cosmetique", total: 40 }),
      }),
    );
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
  it("restores stock and marks the sale cancelled", async () => {
    prismaMock.sale.findFirst.mockResolvedValue({
      id: "sale-1",
      status: "COMPLETED",
      items: [
        { variantId: "variant-1", quantity: 2 },
        { variantId: "variant-2", quantity: 1 },
      ],
    } as never);
    prismaMock.productVariant.update.mockResolvedValue({} as never);
    prismaMock.sale.update.mockResolvedValue({} as never);

    const result = await cancelSale("sale-1");

    expect(result.error).toBeUndefined();
    expect(prismaMock.sale.findFirst).toHaveBeenCalledWith({
      where: { id: "sale-1", productType: "cosmetique" },
      include: { items: true },
    });
    expect(prismaMock.productVariant.update).toHaveBeenCalledWith({
      where: { id: "variant-1" },
      data: { stock: { increment: 2 } },
    });
    expect(prismaMock.sale.update).toHaveBeenCalledWith({
      where: { id: "sale-1" },
      data: { status: "CANCELLED" },
    });
  });

  it("returns notFound for a sale outside the admin's boutique", async () => {
    prismaMock.sale.findFirst.mockResolvedValue(null);

    const result = await cancelSale("sale-from-another-boutique");

    expect(result.error).toBe("notFound");
    expect(prismaMock.sale.update).not.toHaveBeenCalled();
  });

  it("returns alreadyCancelled without touching stock twice", async () => {
    prismaMock.sale.findFirst.mockResolvedValue({
      id: "sale-1",
      status: "CANCELLED",
      items: [{ variantId: "variant-1", quantity: 2 }],
    } as never);

    const result = await cancelSale("sale-1");

    expect(result.error).toBe("alreadyCancelled");
    expect(prismaMock.productVariant.update).not.toHaveBeenCalled();
  });
});
