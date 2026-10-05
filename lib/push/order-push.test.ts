import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/lib/generated/prisma/client";

vi.mock("@/lib/prisma", () => ({ prisma: mockDeep<PrismaClient>() }));

import { prisma } from "@/lib/prisma";
import { sendOrderPush } from "@/lib/push/order-push";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const fetchMock = vi.fn();

function order(overrides: Record<string, unknown> = {}) {
  return {
    reference: "CMD-1",
    locale: "en",
    productType: "sport",
    status: "SHIPPING",
    pushTokens: [
      { id: "t1", token: "ExponentPushToken[aaa]" },
      { id: "t2", token: "ExponentPushToken[bbb]" },
    ],
    ...overrides,
  } as never;
}

beforeEach(() => {
  mockReset(prismaMock);
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("sendOrderPush", () => {
  it("sends one message per registered phone, in the language of the order", async () => {
    prismaMock.order.findUnique.mockResolvedValue(order());
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: [{ status: "ok" }, { status: "ok" }] }) });

    await sendOrderPush("o1", "shipped");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://exp.host/--/api/v2/push/send");
    const messages = JSON.parse(init.body);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      to: "ExponentPushToken[aaa]",
      title: "Order CMD-1",
      body: "Your order is on its way.",
      data: { reference: "CMD-1", status: "SHIPPING", boutique: "sport" },
    });
  });

  it("does nothing when nobody asked to be notified", async () => {
    prismaMock.order.findUnique.mockResolvedValue(order({ pushTokens: [] }));

    await sendOrderPush("o1", "confirmed");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forgets a phone that no longer has the app", async () => {
    prismaMock.order.findUnique.mockResolvedValue(order());
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ status: "ok" }, { status: "error", details: { error: "DeviceNotRegistered" } }] }),
    });

    await sendOrderPush("o1", "delivered");

    expect(prismaMock.pushToken.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["t2"] } } });
  });

  it("never throws: a push service that is down must not fail the admin's action", async () => {
    prismaMock.order.findUnique.mockResolvedValue(order());
    fetchMock.mockRejectedValue(new Error("network down"));

    await expect(sendOrderPush("o1", "confirmed")).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it("does not drop tokens when Expo itself answers with an error", async () => {
    prismaMock.order.findUnique.mockResolvedValue(order());
    fetchMock.mockResolvedValue({ ok: false, status: 503 });

    await sendOrderPush("o1", "confirmed");

    expect(prismaMock.pushToken.deleteMany).not.toHaveBeenCalled();
  });
});
