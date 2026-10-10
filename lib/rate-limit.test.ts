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
import { checkRateLimit, getClientIp, peekRateLimit, rateLimitRetryAfter, recordRateLimitHit } from "@/lib/rate-limit";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const headersMock = headers as unknown as Mock;

beforeEach(() => {
  mockReset(prismaMock);
  headersMock.mockReset();
  // checkRateLimit now runs its prune/count/create inside a $transaction
  // (with a per-key advisory lock) — run the callback against the same mock.
  prismaMock.$transaction.mockImplementation((cb) =>
    (cb as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock),
  );
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

  it("takes a per-key advisory lock so the count/create pair can't race", async () => {
    prismaMock.rateLimitHit.count.mockResolvedValue(0);

    await checkRateLimit("order:1.2.3.4", { windowMs: 1000, max: 5 });

    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(prismaMock.$executeRaw).toHaveBeenCalled();
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

describe("rateLimitRetryAfter", () => {
  it("is null while the call is allowed", async () => {
    prismaMock.rateLimitHit.count.mockResolvedValue(0);

    expect(await rateLimitRetryAfter("k", { windowMs: 60_000, max: 5 })).toBeNull();
  });

  it("gives the seconds until the oldest hit in the window expires", async () => {
    prismaMock.rateLimitHit.count.mockResolvedValue(5);
    prismaMock.rateLimitHit.findFirst.mockResolvedValue({ createdAt: new Date(Date.now() - 45_000) } as never);

    const wait = await rateLimitRetryAfter("k", { windowMs: 60_000, max: 5 });

    expect(wait).toBeGreaterThanOrEqual(15);
    expect(wait).toBeLessThanOrEqual(16);
  });
});

describe("rateLimitRetryAfter past the limit", () => {
  it("waits for enough hits to leave the window, not just the oldest", async () => {
    // 7 hits for a limit of 5 (concurrent calls overshot): the 3rd oldest
    // has to leave before a call is allowed again.
    prismaMock.rateLimitHit.count.mockResolvedValue(7);
    prismaMock.rateLimitHit.findFirst.mockResolvedValue({ createdAt: new Date(Date.now() - 30_000) } as never);

    const wait = await rateLimitRetryAfter("k", { windowMs: 60_000, max: 5 });

    expect(prismaMock.rateLimitHit.findFirst).toHaveBeenCalledWith(expect.objectContaining({ skip: 2 }));
    expect(wait).toBeGreaterThanOrEqual(30);
    expect(wait).toBeLessThanOrEqual(31);
  });
});

describe("peekRateLimit / recordRateLimitHit", () => {
  it("checks without recording anything", async () => {
    prismaMock.rateLimitHit.count.mockResolvedValue(3);

    expect(await peekRateLimit("k", { windowMs: 60_000, max: 5 })).toBeNull();
    expect(prismaMock.rateLimitHit.create).not.toHaveBeenCalled();
  });

  it("gives the wait once the limit is reached", async () => {
    prismaMock.rateLimitHit.count.mockResolvedValue(5);
    prismaMock.rateLimitHit.findFirst.mockResolvedValue({ createdAt: new Date(Date.now() - 50_000) } as never);

    const wait = await peekRateLimit("k", { windowMs: 60_000, max: 5 });

    expect(wait).toBeGreaterThanOrEqual(10);
    expect(wait).toBeLessThanOrEqual(11);
  });

  it("records one hit", async () => {
    await recordRateLimitHit("k");

    expect(prismaMock.rateLimitHit.create).toHaveBeenCalledWith({ data: { key: "k" } });
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

  it("falls back to a stable per-visitor hash when neither IP header is present", async () => {
    headersMock.mockResolvedValue({
      get: (name: string) => {
        if (name === "user-agent") return "Mozilla/5.0 Test";
        if (name === "accept-language") return "fr-FR";
        return null;
      },
    });

    const result = await getClientIp();
    expect(result).toMatch(/^unknown:[0-9a-f]{16}$/);
  });

  it("gives two visitors with different user-agents different fallback buckets", async () => {
    headersMock.mockResolvedValue({
      get: (name: string) => (name === "user-agent" ? "Browser A" : null),
    });
    const a = await getClientIp();
    headersMock.mockResolvedValue({
      get: (name: string) => (name === "user-agent" ? "Browser B" : null),
    });
    const b = await getClientIp();

    expect(a).not.toBe(b);
  });

  it("falls back to the literal \"unknown\" only when every signal is missing", async () => {
    headersMock.mockResolvedValue({ get: () => null });

    await expect(getClientIp()).resolves.toBe("unknown");
  });
});
