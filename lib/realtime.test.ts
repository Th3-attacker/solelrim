import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/report-error", () => ({ reportError: vi.fn() }));

import { reportError } from "@/lib/report-error";
import { adminOrdersTopic, notifyOrdersChanged } from "@/lib/realtime";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.mocked(reportError).mockReset();
});

function stubEnv() {
  vi.stubEnv("DATABASE_URL", "postgresql://x");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
}

describe("notifyOrdersChanged", () => {
  it("broadcasts an empty message on the boutique's topic", async () => {
    stubEnv();
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    await notifyOrdersChanged("sport");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://project.supabase.co/realtime/v1/api/broadcast");
    expect(JSON.parse(init.body)).toEqual({
      messages: [{ topic: adminOrdersTopic("sport"), event: "orders.changed", payload: {} }],
    });
    expect(reportError).not.toHaveBeenCalled();
  });

  it("reports a failure and never throws", async () => {
    stubEnv();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(notifyOrdersChanged("sport")).resolves.toBeUndefined();
    expect(reportError).toHaveBeenCalled();
  });
});
