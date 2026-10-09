import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/lib/generated/prisma/client";

vi.mock("@/lib/prisma", () => ({ prisma: mockDeep<PrismaClient>() }));
vi.mock("@/lib/rate-limit", () => ({
  rateLimitRetryAfter: vi.fn(),
  getClientIp: vi.fn().mockResolvedValue("1.2.3.4"),
}));

import { prisma } from "@/lib/prisma";
import { rateLimitRetryAfter } from "@/lib/rate-limit";
import { registerPushToken, removePushToken } from "@/lib/push/register";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const rateLimitMock = rateLimitRetryAfter as unknown as Mock;

const valid = { phone: "37737353", reference: "cmd-1", token: "ExponentPushToken[abc123]" };

beforeEach(() => {
  mockReset(prismaMock);
  rateLimitMock.mockReset().mockResolvedValue(null);
  prismaMock.order.findFirst.mockResolvedValue({ id: "o1" } as never);
  prismaMock.pushToken.findMany.mockResolvedValue([{ id: "t1" }] as never);
});

describe("registerPushToken", () => {
  it("links the token to the order found with the phone and reference", async () => {
    const result = await registerPushToken("sport", valid);

    expect(result).toEqual({});
    expect(prismaMock.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productType: "sport", customerPhone: "37737353", reference: "CMD-1" },
      }),
    );
    expect(prismaMock.pushToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { orderId: "o1", token: "ExponentPushToken[abc123]" } }),
    );
  });

  it("refuses something that isn't an Expo token", async () => {
    expect(await registerPushToken("sport", { ...valid, token: "not-a-token" })).toEqual({ error: "invalid" });
    expect(prismaMock.pushToken.upsert).not.toHaveBeenCalled();
  });

  it("answers notFound when phone and reference match no order of this boutique", async () => {
    prismaMock.order.findFirst.mockResolvedValue(null);

    expect(await registerPushToken("sport", valid)).toEqual({ error: "notFound" });
    expect(prismaMock.pushToken.upsert).not.toHaveBeenCalled();
  });

  it("is rate-limited per IP, 20 an hour, and says how long to wait", async () => {
    rateLimitMock.mockResolvedValue(120);

    expect(await registerPushToken("sport", valid)).toEqual({ error: "rateLimited", retryAfter: 120 });
    expect(rateLimitMock).toHaveBeenCalledWith("push:1.2.3.4", { windowMs: 3_600_000, max: 20 });
  });

  it("keeps at most 5 tokens per order, dropping the oldest", async () => {
    prismaMock.pushToken.findMany.mockResolvedValue(
      ["a", "b", "c", "d", "e", "f", "g"].map((id) => ({ id })) as never,
    );

    await registerPushToken("sport", valid);

    expect(prismaMock.pushToken.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["f", "g"] } } });
  });
});

describe("removePushToken", () => {
  it("stops the notifications for this phone on this order only", async () => {
    expect(await removePushToken("sport", valid)).toEqual({});
    expect(prismaMock.pushToken.deleteMany).toHaveBeenCalledWith({
      where: { orderId: "o1", token: "ExponentPushToken[abc123]" },
    });
  });
});
