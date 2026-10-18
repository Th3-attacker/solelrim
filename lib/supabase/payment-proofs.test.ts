import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { getSignedPaymentProofUrl, PAYMENT_PROOFS_BUCKET } from "@/lib/supabase/payment-proofs";
import { vercelImagesConfig } from "@/lib/image-config";

describe("payment proofs", () => {
  it("are read through a 5-minute signed URL from the private bucket", async () => {
    const createSignedUrl = vi
      .fn()
      .mockResolvedValue({ data: { signedUrl: "https://signed" }, error: null });
    const from = vi.fn(() => ({ createSignedUrl }));
    vi.mocked(createAdminClient).mockReturnValue({ storage: { from } } as never);

    expect(await getSignedPaymentProofUrl("orders/abc.png")).toBe("https://signed");
    expect(from).toHaveBeenCalledWith(PAYMENT_PROOFS_BUCKET);
    expect(createSignedUrl).toHaveBeenCalledWith("orders/abc.png", 300);
  });

  it("give no URL when Storage refuses", async () => {
    const createSignedUrl = vi
      .fn()
      .mockResolvedValue({ data: null, error: new Error("not found") });
    vi.mocked(createAdminClient).mockReturnValue({
      storage: { from: () => ({ createSignedUrl }) },
    } as never);

    expect(await getSignedPaymentProofUrl("orders/missing.png")).toBeNull();
  });

  it("can't go through the image optimizer, whose copies are public and cached a month", async () => {
    // Signed URLs are /storage/v1/object/sign/...; only public objects match.
    const patterns = vercelImagesConfig().remotePatterns;
    expect(patterns).toHaveLength(1);
    expect(patterns[0]).toMatchObject({ pathname: "^/storage/v1/object/public/.*$" });
  });
});
