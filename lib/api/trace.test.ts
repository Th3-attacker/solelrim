import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isBelowVersion, withApi } from "@/lib/api/trace";

const request = (headers: Record<string, string> = {}) =>
  new Request("https://shop.example/api/v1/boutiques", { headers });
const handler = vi.fn(async () => Response.json({ ok: true }));
const route = withApi(handler);
let info: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  handler.mockClear();
  info = vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  info.mockRestore();
});

describe("withApi", () => {
  it("sends back the app's X-Request-Id and logs it with the app version and platform", async () => {
    const response = await route(
      request({ "X-Request-Id": "req-123", "X-App-Version": "1.2.0", "X-App-Platform": "android" }),
      {},
    );

    expect(response.headers.get("X-Request-Id")).toBe("req-123");
    const line = JSON.parse(info.mock.calls[0][0] as string);
    expect(line).toMatchObject({
      requestId: "req-123",
      method: "GET",
      path: "/api/v1/boutiques",
      status: 200,
      appVersion: "1.2.0",
      appPlatform: "android",
    });
  });

  it("makes up a request id when the app sends none, or a malformed one", async () => {
    const none = await route(request(), {});
    const bad = await route(request({ "X-Request-Id": "has spaces <script>" }), {});

    expect(none.headers.get("X-Request-Id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(bad.headers.get("X-Request-Id")).not.toContain(" ");
  });

  it("answers 426 appUpdateRequired below APP_MIN_VERSION, without running the route", async () => {
    vi.stubEnv("APP_MIN_VERSION", "1.4.0");

    const response = await route(request({ "X-App-Version": "1.3.9" }), {});

    expect(response.status).toBe(426);
    expect(await response.json()).toEqual({ error: "appUpdateRequired" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("lets through an app at or above the minimum, or that sends no version", async () => {
    vi.stubEnv("APP_MIN_VERSION", "1.4.0");

    expect((await route(request({ "X-App-Version": "1.4.0" }), {})).status).toBe(200);
    expect((await route(request(), {})).status).toBe(200);
  });

  it("checks no version when APP_MIN_VERSION is unset", async () => {
    expect((await route(request({ "X-App-Version": "0.0.1" }), {})).status).toBe(200);
  });
});

describe("isBelowVersion", () => {
  it.each([
    ["1.3.9", "1.4.0", true],
    ["1.10.0", "1.9.0", false],
    ["2", "1.9.9", false],
    ["1.4.0 (build 12)", "1.4.0", false],
    ["garbage", "1.4.0", false],
  ])("%s below %s is %s", (version, minimum, expected) => {
    expect(isBelowVersion(version, minimum)).toBe(expected);
  });
});
