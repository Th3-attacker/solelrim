import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/lib/generated/prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));
vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const headersMock = headers as unknown as Mock;

beforeEach(() => {
  mockReset(prismaMock);
  headersMock.mockReset();
});

describe("checkRateLimit", () => {
  it("prunes hits older than the window before counting", async () => {
    prismaMock.rateLimitHit.count.mockResolvedValue(0);

    await checkRateLimit("order:1.2.3.4", { windowMs: 1000, max: 5 });

    expect(prismaMock.rateLimitHit.deleteMany).toHaveBeenCalledWith({
      where: { key: "order:1.2.3.4", createdAt: { lt: expect.any(Date) } },
    });
    const call = prismaMock.rateLimitHit.deleteMany.mock.calls[0][0] as {
      where: { key: string; createdAt: { lt: Date } };
    };
    expect(call.where.createdAt.lt.getTime()).toBeLessThanOrEqual(Date.now() - 999);
  });

  it("allows the call and records a hit when under the limit", async () => {
    prismaMock.rateLimitHit.count.mockResolvedValue(4);

    const allowed = await checkRateLimit("order:1.2.3.4", { windowMs: 1000, max: 5 });

    expect(allowed).toBe(true);
    expect(prismaMock.rateLimitHit.create).toHaveBeenCalledWith({
      data: { key: "order:1.2.3.4" },
    });
  });

  it("blocks and records nothing once the count reaches the limit", async () => {
    prismaMock.rateLimitHit.count.mockResolvedValue(5);

    const allowed = await checkRateLimit("order:1.2.3.4", { windowMs: 1000, max: 5 });

    expect(allowed).toBe(false);
    expect(prismaMock.rateLimitHit.create).not.toHaveBeenCalled();
  });
});

describe("getClientIp", () => {
  it("takes the first address from a comma-separated x-forwarded-for", async () => {
    headersMock.mockResolvedValue({
      get: (name: string) =>
        name === "x-forwarded-for" ? "203.0.113.9, 10.0.0.1" : null,
    });

    await expect(getClientIp()).resolves.toBe("203.0.113.9");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", async () => {
    headersMock.mockResolvedValue({
      get: (name: string) => (name === "x-real-ip" ? "198.51.100.7" : null),
    });

    await expect(getClientIp()).resolves.toBe("198.51.100.7");
  });

  it("falls back to \"unknown\" when neither header is present", async () => {
    headersMock.mockResolvedValue({ get: () => null });

    await expect(getClientIp()).resolves.toBe("unknown");
  });
});
