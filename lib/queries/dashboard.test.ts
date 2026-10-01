import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/lib/generated/prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from "@/lib/prisma";
import { getBestSellers } from "@/lib/queries/dashboard";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

// The SQL text of the one $queryRaw call (a tagged template: strings first).
function sqlOf(call: unknown[]): string {
  return (call[0] as TemplateStringsArray).join("?");
}

describe("getBestSellers", () => {
  beforeEach(() => {
    mockReset(prismaMock);
  });

  it("ranks on units kept: cancelled sales excluded, refunded units taken off", async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      { variantId: "v-2", quantity: 7, revenue: 7000 },
      { variantId: "v-1", quantity: 3, revenue: 1500 },
    ] as never);
    prismaMock.productVariant.findMany.mockResolvedValue([
      { id: "v-1", size: "M", color: "Noir", product: { name: "Maillot" } },
      { id: "v-2", size: "L", color: "Blanc", product: { name: "Short" } },
    ] as never);

    const result = await getBestSellers("sport", 2);

    const sql = sqlOf(prismaMock.$queryRaw.mock.calls[0] as unknown[]);
    expect(sql).toContain(`"status" <> 'CANCELLED'`);
    expect(sql).toContain(`"quantity" - i."refundedQuantity"`);
    expect(result.map((r) => [r.variantId, r.quantity, r.revenue])).toEqual([
      ["v-2", 7, 7000],
      ["v-1", 3, 1500],
    ]);
    expect(result[0]).toMatchObject({ productName: "Short", size: "L", color: "Blanc" });
  });

  it("skips a variant that no longer exists", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ variantId: "gone", quantity: 2, revenue: 10 }] as never);
    prismaMock.productVariant.findMany.mockResolvedValue([] as never);

    expect(await getBestSellers("sport")).toEqual([]);
  });
});
