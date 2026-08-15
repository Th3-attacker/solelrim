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
import { deleteProduct, updateProduct, updateProductImageColor } from "@/lib/actions/products";
import type { ProductInput } from "@/lib/validation/product";

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

const baseVariant = {
  size: "M",
  color: "Rouge",
  sku: "SKU-1",
  price: null,
  stock: 5,
  lowStockThreshold: 5,
};

function productInput(overrides: Partial<ProductInput> = {}): ProductInput {
  return {
    name: "Produit",
    description: "",
    basePrice: 100,
    compareAtPrice: null,
    isFeatured: false,
    categoryId: "category-1",
    isActive: true,
    variants: [{ ...baseVariant, id: "variant-1" }],
    ...overrides,
  };
}

describe("updateProduct", () => {
  it("returns notFound for a product outside the admin's boutique", async () => {
    prismaMock.product.findFirst.mockResolvedValue(null);

    const result = await updateProduct("product-1", productInput());

    expect(result.error).toBe("notFound");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("returns invalid for a category outside the admin's boutique", async () => {
    prismaMock.product.findFirst.mockResolvedValue({ id: "product-1" } as never);
    prismaMock.category.findFirst.mockResolvedValue(null);

    const result = await updateProduct("product-1", productInput());

    expect(result.error).toBe("invalid");
    expect(prismaMock.category.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "category-1",
          OR: [{ productType: null }, { productType: "cosmetique" }],
        },
      }),
    );
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("blocks removing a variant that has a linked sale or order", async () => {
    prismaMock.product.findFirst.mockResolvedValue({ id: "product-1" } as never);
    prismaMock.category.findFirst.mockResolvedValue({ id: "category-1" } as never);
    prismaMock.productVariant.findMany.mockResolvedValue([
      { id: "variant-1" },
      { id: "variant-2" },
    ] as never);
    prismaMock.productVariant.findFirst.mockResolvedValue({ id: "variant-2" } as never);

    // Submitted form only has variant-1 — variant-2 is being dropped.
    const result = await updateProduct("product-1", productInput());

    expect(result.error).toBe("variantHasSales");
    expect(prismaMock.productVariant.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: ["variant-2"] },
          OR: [{ saleItems: { some: {} } }, { orderItems: { some: {} } }],
        },
      }),
    );
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("allows removing a variant with no sale/order history", async () => {
    prismaMock.product.findFirst.mockResolvedValue({ id: "product-1" } as never);
    prismaMock.category.findFirst.mockResolvedValue({ id: "category-1" } as never);
    prismaMock.productVariant.findMany.mockResolvedValue([
      { id: "variant-1" },
      { id: "variant-2" },
    ] as never);
    prismaMock.productVariant.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (fn) =>
      (fn as (tx: typeof prismaMock) => unknown)(prismaMock),
    );
    prismaMock.product.update.mockResolvedValue({ slug: "produit" } as never);

    const result = await updateProduct("product-1", productInput());

    expect(result.error).toBeUndefined();
    expect(result.productId).toBe("product-1");
    expect(prismaMock.productVariant.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["variant-2"] } },
    });
  });

  it("untags product images whose color no longer matches any submitted variant", async () => {
    prismaMock.product.findFirst.mockResolvedValue({ id: "product-1" } as never);
    prismaMock.category.findFirst.mockResolvedValue({ id: "category-1" } as never);
    prismaMock.productVariant.findMany.mockResolvedValue([
      { id: "variant-1" },
    ] as never);
    prismaMock.$transaction.mockImplementation(async (fn) =>
      (fn as (tx: typeof prismaMock) => unknown)(prismaMock),
    );
    prismaMock.product.update.mockResolvedValue({ slug: "produit" } as never);

    await updateProduct(
      "product-1",
      productInput({
        variants: [{ ...baseVariant, id: "variant-1", color: "Bleu" }],
      }),
    );

    expect(prismaMock.productImage.updateMany).toHaveBeenCalledWith({
      where: { productId: "product-1", color: { not: null, notIn: ["Bleu"] } },
      data: { color: null },
    });
  });
});

describe("updateProductImageColor", () => {
  it("returns notFound for an image outside the admin's boutique", async () => {
    prismaMock.productImage.findUnique.mockResolvedValue({
      id: "image-1",
      productId: "product-1",
      product: { slug: "other-slug", productType: "sport" },
    } as never);

    const result = await updateProductImageColor("image-1", "Rouge");

    expect(result.error).toBe("notFound");
    expect(prismaMock.productImage.update).not.toHaveBeenCalled();
  });

  it("tags the image with the given color", async () => {
    prismaMock.productImage.findUnique.mockResolvedValue({
      id: "image-1",
      productId: "product-1",
      product: { slug: "product-1-slug", productType: "cosmetique" },
    } as never);
    prismaMock.productImage.update.mockResolvedValue({} as never);

    const result = await updateProductImageColor("image-1", "Rouge");

    expect(result.error).toBeUndefined();
    expect(prismaMock.productImage.update).toHaveBeenCalledWith({
      where: { id: "image-1" },
      data: { color: "Rouge" },
    });
  });

  it("clears the color when passed null", async () => {
    prismaMock.productImage.findUnique.mockResolvedValue({
      id: "image-1",
      productId: "product-1",
      product: { slug: "product-1-slug", productType: "cosmetique" },
    } as never);
    prismaMock.productImage.update.mockResolvedValue({} as never);

    await updateProductImageColor("image-1", null);

    expect(prismaMock.productImage.update).toHaveBeenCalledWith({
      where: { id: "image-1" },
      data: { color: null },
    });
  });
});
