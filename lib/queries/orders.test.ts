import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/lib/generated/prisma/client";

vi.mock("@/lib/prisma", () => ({ prisma: mockDeep<PrismaClient>() }));

import { prisma } from "@/lib/prisma";
import { getOrdersSharingPaymentProof } from "@/lib/queries/orders";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

beforeEach(() => mockReset(prismaMock));

describe("getOrdersSharingPaymentProof", () => {
  it("finds the boutique's other orders sent with the same screenshot", async () => {
    prismaMock.order.findMany.mockResolvedValue([{ id: "o0", reference: "CMD-A" }] as never);

    const others = await getOrdersSharingPaymentProof({ id: "o1", productType: "sport", paymentProofHash: "abc" });

    expect(others).toEqual([{ id: "o0", reference: "CMD-A" }]);
    expect(prismaMock.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productType: "sport", paymentProofHash: "abc", id: { not: "o1" } },
      }),
    );
  });

  it("looks nothing up for an order placed before screenshots were hashed", async () => {
    expect(await getOrdersSharingPaymentProof({ id: "o1", productType: "sport", paymentProofHash: null })).toEqual([]);
    expect(prismaMock.order.findMany).not.toHaveBeenCalled();
  });
});
