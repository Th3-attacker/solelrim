import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/lib/generated/prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteProduct } from "@/lib/actions/products";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const createClientMock = createClient as unknown as Mock;
const createAdminClientMock = createAdminClient as unknown as Mock;

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
  createAdminClientMock.mockReset();
  asAdmin();
});

describe("deleteProduct", () => {
  it("returns notFound for a product outside the admin's boutique", async () => {
    prismaMock.product.findFirst.mockResolvedValue(null);

    const result = await deleteProduct("product-from-another-boutique");

    expect(result.error).toBe("notFound");
    expect(prismaMock.product.delete).not.toHaveBeenCalled();
  });

  it("blocks deletion when a variant has a linked sale or order", async () => {
    prismaMock.product.findFirst.mockResolvedValue({ id: "product-1" } as never);
    prismaMock.productVariant.findFirst.mockResolvedValue({ id: "variant-1" } as never);

    const result = await deleteProduct("product-1");

    expect(result.error).toBe("hasSales");
    expect(prismaMock.productVariant.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          productId: "product-1",
          OR: [{ saleItems: { some: {} } }, { orderItems: { some: {} } }],
        },
      }),
    );
    expect(prismaMock.product.delete).not.toHaveBeenCalled();
  });

  it("deletes the product and its stored images when nothing references it", async () => {
    prismaMock.product.findFirst.mockResolvedValue({ id: "product-1" } as never);
    prismaMock.productVariant.findFirst.mockResolvedValue(null);
    prismaMock.productImage.findMany.mockResolvedValue([
      { storagePath: "products/product-1/a.jpg" },
      { storagePath: "products/product-1/b.jpg" },
    ] as never);
    prismaMock.product.delete.mockResolvedValue({} as never);
    const removeMock = vi.fn().mockResolvedValue({ error: null });
    createAdminClientMock.mockReturnValue({
      storage: { from: vi.fn().mockReturnValue({ remove: removeMock }) },
    });

    const result = await deleteProduct("product-1");

    expect(result.error).toBeUndefined();
    expect(prismaMock.product.delete).toHaveBeenCalledWith({ where: { id: "product-1" } });
    expect(removeMock).toHaveBeenCalledWith([
      "products/product-1/a.jpg",
      "products/product-1/b.jpg",
    ]);
  });
});
