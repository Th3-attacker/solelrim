import { afterEach, describe, expect, it, vi } from "vitest";
import { shareContent, isShareCancelled } from "@/lib/shop/web-share";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("shareContent", () => {
  it("uses the native share sheet when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share });

    const data = { title: "t", url: "https://example.com" };
    const result = await shareContent(data);

    expect(result).toBe("shared");
    expect(share).toHaveBeenCalledWith(data);
  });

  it("falls back to the clipboard when navigator.share doesn't exist", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    const result = await shareContent({ title: "My cart", text: "line", url: "https://x.co" });

    expect(result).toBe("copied");
    expect(writeText).toHaveBeenCalledWith("My cart\nline\nhttps://x.co");
  });

  it("falls back to the clipboard when canShare rejects the data", async () => {
    const share = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      share,
      canShare: () => false,
      clipboard: { writeText },
    });

    const result = await shareContent({ title: "t" });

    expect(result).toBe("copied");
    expect(share).not.toHaveBeenCalled();
  });

  it("throws when neither share nor clipboard is available (insecure context)", async () => {
    vi.stubGlobal("navigator", {});

    await expect(shareContent({ title: "t" })).rejects.toThrow("share-unavailable");
  });

  it("propagates a real navigator.share failure instead of swallowing it", async () => {
    const share = vi.fn().mockRejectedValue(new Error("boom"));
    vi.stubGlobal("navigator", { share });

    await expect(shareContent({ title: "t" })).rejects.toThrow("boom");
  });
});

describe("isShareCancelled", () => {
  it("recognizes the AbortError the share sheet rejects with on user cancel", () => {
    const error = Object.assign(new Error("cancelled"), { name: "AbortError" });
    expect(isShareCancelled(error)).toBe(true);
  });

  it("does not treat other errors as a cancellation", () => {
    expect(isShareCancelled(new Error("boom"))).toBe(false);
    expect(isShareCancelled("not an error")).toBe(false);
  });
});
