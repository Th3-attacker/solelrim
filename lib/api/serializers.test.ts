import { describe, expect, it, vi } from "vitest";
import { serializeBoutique, serializeProductDetail } from "@/lib/api/serializers";

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
    { id: "v1", size: "M", color: "WHITE", sku: "SECRET-SKU", price: null, stock: 9, lowStockThreshold: 5 },
    { id: "v2", size: "L", color: "WHITE", sku: "SECRET-SKU-2", price: decimal(1200), stock: 0, lowStockThreshold: 5 },
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
      { id: "v1", size: "M", color: "WHITE", price: 1000, stock: 9 },
      { id: "v2", size: "L", color: "WHITE", price: 1200, stock: 0 },
    ]);
  });

  it("does not leak internal columns", () => {
    const text = JSON.stringify(out);
    expect(text).not.toContain("SECRET-SKU");
    expect(text).not.toContain("lowStockThreshold");
    expect(text).not.toContain("updatedAt");
    expect(text).not.toContain("productType");
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
      { provider: "Bankily", number: "11111111", logoStoragePath: null },
      { provider: "Ma banque", number: "22222222", logoStoragePath: "w/x.png" },
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
        provider: "Bankily",
        providerKey: "bankily",
        number: "11111111",
        logoUrl: "https://shop.example/wallets/bankily.svg",
      },
      {
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
