import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/shop/pending-expiry", () => ({ cancelExpiredPendingOrders: vi.fn() }));

import { cancelExpiredPendingOrders } from "@/lib/shop/pending-expiry";
import { GET } from "@/app/api/cron/expire-pending-orders/route";

const cancelMock = cancelExpiredPendingOrders as unknown as Mock;
const call = (authorization?: string) =>
  GET(new Request("https://shop.example/api/cron/expire-pending-orders", {
    headers: authorization ? { authorization } : {},
  }));

beforeEach(() => {
  cancelMock.mockReset().mockResolvedValue([]);
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/cron/expire-pending-orders", () => {
  it("runs with Vercel Cron's bearer secret", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    cancelMock.mockResolvedValue(["CMD-A", "CMD-B"]);

    const response = await call("Bearer s3cret");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ cancelled: 2 });
  });

  it("refuses a wrong secret", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");

    expect((await call("Bearer nope")).status).toBe(401);
    expect(cancelMock).not.toHaveBeenCalled();
  });

  it("refuses everything when CRON_SECRET isn't set", async () => {
    vi.stubEnv("CRON_SECRET", "");

    expect((await call("Bearer ")).status).toBe(401);
    expect(cancelMock).not.toHaveBeenCalled();
  });
});
