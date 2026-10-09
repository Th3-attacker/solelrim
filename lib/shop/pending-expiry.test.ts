import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/lib/generated/prisma/client";

vi.mock("@/lib/prisma", () => ({ prisma: mockDeep<PrismaClient>() }));
vi.mock("@/lib/push/order-push", () => ({ sendOrderPush: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { sendOrderPush } from "@/lib/push/order-push";
import { cancelExpiredPendingOrders } from "@/lib/shop/pending-expiry";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const pushMock = sendOrderPush as unknown as Mock;
const NOW = new Date("2026-10-09T12:00:00Z");

beforeEach(() => {
  mockReset(prismaMock);
  pushMock.mockReset();
  prismaMock.$transaction.mockImplementation((cb) =>
    (cb as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock),
  );
  prismaMock.storeType.findMany.mockResolvedValue([{ key: "sport", pendingAutoCancelHours: 48 }] as never);
  prismaMock.order.findMany.mockResolvedValue([{ id: "o1" }] as never);
  prismaMock.order.updateMany.mockResolvedValue({ count: 1 } as never);
  prismaMock.order.findUniqueOrThrow.mockResolvedValue({
    id: "o1",
    reference: "CMD-OLD",
    promoCodeId: "promo-1",
    items: [{ variantId: "v1", quantity: 2 }],
  } as never);
});

describe("cancelExpiredPendingOrders", () => {
  it("only looks at boutiques that turned it on, and their PENDING orders past the delay", async () => {
    await cancelExpiredPendingOrders(NOW);

    expect(prismaMock.storeType.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { pendingAutoCancelHours: { not: null } } }),
    );
    expect(prismaMock.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          productType: "sport",
          status: "PENDING",
          createdAt: { lt: new Date("2026-10-07T12:00:00Z") },
        },
      }),
    );
  });

  it("cancels the order, gives back stock and the promo code, and notifies the phone", async () => {
    const cancelled = await cancelExpiredPendingOrders(NOW);

    expect(cancelled).toEqual(["CMD-OLD"]);
    expect(prismaMock.order.updateMany).toHaveBeenCalledWith({
      where: { id: "o1", status: "PENDING" },
      data: { status: "CANCELLED", cancelledAt: NOW, cancelReason: "payment_timeout" },
    });
    expect(prismaMock.productVariant.update).toHaveBeenCalledWith({
      where: { id: "v1" },
      data: { stock: { increment: 2 } },
    });
    expect(prismaMock.promoCode.update).toHaveBeenCalledWith({
      where: { id: "promo-1" },
      data: { usedCount: { decrement: 1 } },
    });
    expect(pushMock).toHaveBeenCalledWith("o1", "cancelled");
  });

  it("leaves alone an order an admin validated in the meantime", async () => {
    prismaMock.order.updateMany.mockResolvedValue({ count: 0 } as never);

    expect(await cancelExpiredPendingOrders(NOW)).toEqual([]);
    expect(prismaMock.productVariant.update).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
