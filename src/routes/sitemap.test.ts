import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/queries/settings", () => ({
  getStoreTypes: vi.fn().mockResolvedValue([{ key: "sport", domain: null }]),
}));
vi.mock("@/lib/queries/shop", () => ({
  getActiveProducts: vi
    .fn()
    .mockResolvedValue([{ slug: "t-shirt", updatedAt: new Date("2026-10-01T10:00:00Z") }]),
}));

import { Route } from "@/src/routes/sitemap[.]xml";

// Appelle le handler GET de la route comme le ferait le serveur.
const get = () =>
  (
    Route as unknown as { options: { server: { handlers: { GET: () => Promise<Response> } } } }
  ).options.server.handlers.GET();

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.example"));

describe("GET /sitemap.xml", () => {
  it("est mis en cache côté CDN", async () => {
    const response = await get();

    expect(response.headers.get("Cache-Control")).toContain("s-maxage=3600");
  });

  it("n'indique lastmod que pour les produits, pas pour les pages statiques", async () => {
    const xml = await (await get()).text();
    const blocks = xml.split("<url>").slice(1);
    const home = blocks.find((b) => b.includes("<loc>https://shop.example/fr/sport</loc>"))!;
    const product = blocks.find((b) => b.includes("/products/t-shirt</loc>"))!;

    expect(home).not.toContain("<lastmod>");
    expect(product).toContain("<lastmod>2026-10-01T10:00:00.000Z</lastmod>");
  });
});
