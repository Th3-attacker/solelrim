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
import { moveCategory } from "@/lib/actions/categories";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const createClientMock = createClient as unknown as Mock;

// Mirrors lib/actions/products.test.ts: requireAdminScope() resolves
// straight from this AdminUser row for a BOUTIQUE_ADMIN, no
// cookies()/getStoreTypes() lookups needed.
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
  asAdmin();
});

describe("moveCategory", () => {
  it("returns notFound for an id that doesn't exist", async () => {
    prismaMock.category.findUnique.mockResolvedValue(null);

    const result = await moveCategory("missing", "up");

    expect(result.error).toBe("notFound");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("returns forbidden for a boutique admin moving another boutique's category", async () => {
    prismaMock.category.findUnique.mockResolvedValue({
      id: "cat-1",
      productType: "sport",
    } as never);

    const result = await moveCategory("cat-1", "up");

    expect(result.error).toBe("forbidden");
    expect(prismaMock.category.findMany).not.toHaveBeenCalled();
  });

  it("returns forbidden for a boutique admin moving a generic category", async () => {
    prismaMock.category.findUnique.mockResolvedValue({
      id: "cat-1",
      productType: null,
    } as never);

    const result = await moveCategory("cat-1", "up");

    expect(result.error).toBe("forbidden");
  });

  it("does nothing when already first and moving up", async () => {
    prismaMock.category.findUnique.mockResolvedValue({
      id: "cat-1",
      productType: "cosmetique",
    } as never);
    prismaMock.category.findMany.mockResolvedValue([
      { id: "cat-1", position: 0, name: "A" },
      { id: "cat-2", position: 1, name: "B" },
    ] as never);

    const result = await moveCategory("cat-1", "up");

    expect(result.error).toBeUndefined();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("swaps with the next sibling and reassigns positions by new order", async () => {
    prismaMock.category.findUnique.mockResolvedValue({
      id: "cat-1",
      productType: "cosmetique",
    } as never);
    prismaMock.category.findMany.mockResolvedValue([
      { id: "cat-1", position: 0, name: "A" },
      { id: "cat-2", position: 1, name: "B" },
      { id: "cat-3", position: 2, name: "C" },
    ] as never);
    prismaMock.$transaction.mockResolvedValue([] as never);

    await moveCategory("cat-1", "down");

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.category.update).toHaveBeenCalledWith({
      where: { id: "cat-2" },
      data: { position: 0 },
    });
    expect(prismaMock.category.update).toHaveBeenCalledWith({
      where: { id: "cat-1" },
      data: { position: 1 },
    });
    expect(prismaMock.category.update).toHaveBeenCalledWith({
      where: { id: "cat-3" },
      data: { position: 2 },
    });
  });

  it("only reorders among the category's own scope, ignoring other scopes' siblings", async () => {
    // A boutique admin's own category, moved "up" — must only ever compare
    // against siblings sharing that same productType (verified via the
    // findMany call), never generic (null) or another boutique's rows.
    prismaMock.category.findUnique.mockResolvedValue({
      id: "cat-2",
      productType: "cosmetique",
    } as never);
    prismaMock.category.findMany.mockResolvedValue([
      { id: "cat-1", position: 0, name: "A" },
      { id: "cat-2", position: 1, name: "B" },
    ] as never);
    prismaMock.$transaction.mockResolvedValue([] as never);

    await moveCategory("cat-2", "up");

    expect(prismaMock.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { productType: "cosmetique" } }),
    );
  });
});
