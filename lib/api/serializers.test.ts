import { describe, expect, it, vi } from "vitest";
import { serializeBoutique, serializeProductDetail, serializeProductSummary } from "@/lib/api/serializers";

// At the top level: the describe blocks below build their output while the
// file is collected, before any beforeAll would run.
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://files.example");

const decimal = (n: number) => ({ toNumber: () => n, valueOf: () => n });

const product = {
  id: "p1",
  slug: "t-shirt",
  name: "T-shirt",
  description: "Coton",
  basePrice: decimal(1000),
  compareAtPrice: decimal(1500),
  isFeatured: true,
  isActive: true,
  productType: "sport",
  // Not for the app: must never show up in the output.
  updatedAt: new Date(),
  category: { id: "c1", name: "Vêtements", productType: null, position: 0 },
  images: [{ id: "i1", storagePath: "p/a.jpg", color: "WHITE", position: 0 }],
  variants: [
    { id: "v1", size: "M", color: "WHITE", sku: "SECRET-SKU", price: null, stock: 9, lowStockThreshold: 3, createdAt: new Date(1) },
    { id: "v2", size: "L", color: "WHITE", sku: "SECRET-SKU-2", price: decimal(1200), stock: 0, lowStockThreshold: 5, createdAt: new Date(1) },
  ],
};

describe("serializeProductDetail", () => {
  const out = serializeProductDetail(product as never);

  it("gives the app what it needs to show and order the product", () => {
    expect(out).toMatchObject({
      id: "p1",
      slug: "t-shirt",
      price: { min: 1000, max: 1200 },
      compareAtPrice: 1500,
      inStock: true,
      imageUrl: "https://files.example/storage/v1/object/public/product-images/p/a.jpg",
    });
    expect(out.variants).toEqual([
      { id: "v1", size: "M", color: "WHITE", price: 1000, stock: 9, lowStockThreshold: 3 },
      { id: "v2", size: "L", color: "WHITE", price: 1200, stock: 0, lowStockThreshold: 5 },
    ]);
  });

  it("sends each variant's own low-stock threshold", () => {
    expect(out.variants.map((variant) => variant.lowStockThreshold)).toEqual([3, 5]);
  });

  it("carries the summary's color fields too", () => {
    expect(out.colors).toEqual(["WHITE"]);
    expect(out.colorSwatches).toEqual([{ name: "WHITE", hex: "#ffffff", hexes: ["#ffffff"] }]);
  });

  it("does not leak internal columns", () => {
    const text = JSON.stringify(out);
    expect(text).not.toContain("SECRET-SKU");
    expect(text).not.toContain("updatedAt");
    expect(text).not.toContain("productType");
  });
});

describe("serializeProductSummary colors", () => {
  const variant = (id: string, color: string, stock: number, createdAt: number) => ({
    id, size: "M", color, sku: `SKU-${id}`, price: null, stock, lowStockThreshold: 5, createdAt: new Date(createdAt),
  });
  const out = serializeProductSummary({
    ...product,
    // Size order on the product page, not entry order: colors still follow entry order.
    variants: [
      variant("v3", "Noir-Blanc", 0, 3),
      variant("v1", "Noir", 0, 1),
      variant("v2", "Kaki clair", 4, 2),
      variant("v4", "Noir", 2, 4),
    ],
  } as never);

  it("lists distinct colors in entry order", () => {
    expect(out.colors).toEqual(["Noir", "Kaki clair", "Noir-Blanc"]);
  });

  it("lists the colors with at least one variant in stock", () => {
    expect(out.colorsInStock).toEqual(["Kaki clair", "Noir"]);
  });

  it("gives a hex per color, null when the name is unknown, one per segment for compounds", () => {
    expect(out.colorSwatches).toEqual([
      { name: "Noir", hex: "#18181b", hexes: ["#18181b"] },
      { name: "Kaki clair", hex: null, hexes: [null] },
      { name: "Noir-Blanc", hex: "#18181b", hexes: ["#18181b", "#ffffff"] },
    ]);
  });
});

describe("serializeBoutique", () => {
  const boutique = {
    key: "sport",
    label: "Sport",
    siteName: "Solal Sport",
    siteNameAr: null,
    siteNameEn: "Solal Sport EN",
    announcementText: "  ",
    logoStoragePath: null,
    heroImagePath: null,
    heroTitle: null,
    heroTitleAr: null,
    heroTitleEn: null,
    heroSubtitle: null,
    heroSubtitleAr: null,
    heroSubtitleEn: null,
    heroCtaLabel: null,
    seoTitle: "internal seo",
    seoTitleAr: null,
    seoTitleEn: null,
    seoDescription: null,
    seoDescriptionAr: null,
    seoDescriptionEn: null,
    themeId: "default",
    customThemeColor: null,
    colorMode: "auto",
    couponsEnabled: true,
    paymentInstructions: "Envoyez le montant",
    adminWhatsappNumber: "22334455",
    licenseStatus: "ACTIVE",
    domain: "secret-domain.example",
    walletAccounts: [
      { id: "w1", provider: "Bankily", number: "11111111", logoStoragePath: null },
      { id: "w2", provider: "Ma banque", number: "22222222", logoStoragePath: "w/x.png" },
    ],
    socialLinks: [{ platform: "instagram", url: "https://instagram.com/x" }],
  };
  const out = serializeBoutique(boutique as never, "en", "https://shop.example");

  it("localises the name and hides an empty announcement bar", () => {
    expect(out.name).toBe("Solal Sport EN");
    expect(out.announcement).toBeNull();
  });

  it("lists wallets with the bundled logo of a known provider, the uploaded one otherwise", () => {
    expect(out.payment.wallets).toEqual([
      {
        id: "w1",
        provider: "Bankily",
        providerKey: "bankily",
        number: "11111111",
        logoUrl: "https://shop.example/wallets/bankily.svg",
      },
      {
        id: "w2",
        provider: "Ma banque",
        providerKey: null,
        number: "22222222",
        logoUrl: "https://files.example/storage/v1/object/public/product-images/w/x.png",
      },
    ]);
  });

  it("keeps SEO texts, domain and license internals out", () => {
    const text = JSON.stringify(out);
    expect(text).not.toContain("internal seo");
    expect(text).not.toContain("secret-domain");
    expect(text).not.toContain("licenseStatus");
  });
});
