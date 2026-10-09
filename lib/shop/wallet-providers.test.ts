import { describe, expect, it } from "vitest";
import { findWalletProvider, walletLogoSrc } from "@/lib/shop/wallet-providers";

describe("findWalletProvider", () => {
  it("matches a provider whatever its case or spacing", () => {
    expect(findWalletProvider("  BANKILY ")?.key).toBe("bankily");
  });

  it("matches the alternative spellings", () => {
    expect(findWalletProvider("Masrvi")?.key).toBe("masrivi");
    expect(findWalletProvider("Bim Bank")?.key).toBe("bimbank");
  });

  it("knows nothing about a free-text provider", () => {
    expect(findWalletProvider("Ma banque")).toBeUndefined();
  });
});

describe("walletLogoSrc", () => {
  it("uses the bundled logo of a known provider, even if one was uploaded", () => {
    expect(walletLogoSrc("Sedad", "https://cdn/x.png")).toBe("/wallets/sedad.svg");
  });

  it("falls back to the uploaded logo of an unknown provider, then to nothing", () => {
    expect(walletLogoSrc("Ma banque", "https://cdn/x.png")).toBe("https://cdn/x.png");
    expect(walletLogoSrc("Ma banque", null)).toBeNull();
  });
});
