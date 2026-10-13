import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/lib/generated/prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import {
  updateBoutiqueSettings,
  uploadStoreHeroImage,
  removeStoreHeroImage,
  uploadStoreLogo,
  removeStoreLogo,
  setStoreTheme,
  setCustomThemeColor,
  setColorMode,
  setHeroVariant,
  setCardVariant,
  setFooterVariant,
} from "@/lib/actions/settings";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const createClientMock = createClient as unknown as Mock;
const cookiesMock = cookies as unknown as Mock;

// setStoreTheme/setHeroVariant/setCardVariant/etc. are superadmin-only but
// still scoped to "whichever boutique they're currently managing" — that
// resolution (requireAdminScope -> getAdminScope) reads the scope cookie
// and validates it against the real StoreType table, both mocked here the
// same way lib/auth/scope.test.ts does.
const STORE_TYPES = [{ key: "cosmetique", label: "Cosmétique", createdAt: new Date() }];

function asSuperAdminScopedTo(productType: string) {
  asSuperAdmin();
  prismaMock.storeType.findMany.mockResolvedValue(STORE_TYPES as never);
  cookiesMock.mockResolvedValue({ get: () => ({ value: productType }) });
}

// Mirrors lib/actions/orders.test.ts: requireAdminScope()/requireSuperAdmin()
// both resolve straight from this AdminUser row for a BOUTIQUE_ADMIN, no
// cookies()/getStoreTypes() lookups needed.
function asBoutiqueAdmin(productType = "cosmetique") {
  createClientMock.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-1" } } }) },
  });
  prismaMock.adminUser.findUnique.mockResolvedValue({
    id: "admin-user-1",
    supabaseUserId: "admin-1",
    role: "BOUTIQUE_ADMIN",
    productType,
    createdAt: new Date(),
  } as never);
}

function asSuperAdmin() {
  createClientMock.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "super-1" } } }) },
  });
  prismaMock.adminUser.findUnique.mockResolvedValue({
    id: "admin-user-2",
    supabaseUserId: "super-1",
    role: "SUPERADMIN",
    productType: null,
    createdAt: new Date(),
  } as never);
}

beforeEach(() => {
  mockReset(prismaMock);
  createClientMock.mockReset();
  cookiesMock.mockReset();
});

describe("updateBoutiqueSettings", () => {
  it("updates the acting admin's own boutique", async () => {
    asBoutiqueAdmin("cosmetique");
    prismaMock.storeType.update.mockResolvedValue({} as never);

    const result = await updateBoutiqueSettings({
      adminWhatsappNumber: "22345678",
    });

    expect(result.error).toBeUndefined();
    expect(prismaMock.storeType.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: "cosmetique" } }),
    );
  });

  it("ignores the hero section fields and the SEO texts sent by a boutique admin", async () => {
    asBoutiqueAdmin("cosmetique");
    prismaMock.storeType.update.mockResolvedValue({} as never);

    await updateBoutiqueSettings({
      adminWhatsappNumber: "22345678",
      announcementText: "Soldes",
      seoTitle: "Titre pirate",
      seoDescription: "Description pirate",
      heroImagePosition: "left",
      heroTitle: "Titre pirate",
      heroCtaLabel: "Acheter",
    });

    const { data } = prismaMock.storeType.update.mock.calls[0][0];
    expect(data).toMatchObject({ announcementText: "Soldes" });
    expect(data).not.toHaveProperty("seoTitle");
    expect(data).not.toHaveProperty("seoDescription");
    expect(data).not.toHaveProperty("heroImagePosition");
    expect(data).not.toHaveProperty("heroTitle");
    expect(data).not.toHaveProperty("heroCtaLabel");
  });

  it("saves the SEO texts for a superadmin", async () => {
    asSuperAdminScopedTo("cosmetique");
    prismaMock.storeType.update.mockResolvedValue({} as never);

    await updateBoutiqueSettings({ adminWhatsappNumber: "22345678", seoTitle: "Mon titre" });

    expect(prismaMock.storeType.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ seoTitle: "Mon titre" }) }),
    );
  });

  it("rejects input missing the required whatsapp number", async () => {
    asBoutiqueAdmin();

    const result = await updateBoutiqueSettings({
      adminWhatsappNumber: "",
    });

    expect(result.error).toBe("invalid");
    expect(prismaMock.storeType.update).not.toHaveBeenCalled();
  });
});

describe("hero image and logo (superadmin only)", () => {
  it("refuses a boutique admin both an upload and a removal", async () => {
    asBoutiqueAdmin("cosmetique");

    await expect(uploadStoreLogo(new FormData())).rejects.toThrow("forbidden");
    await expect(removeStoreLogo()).rejects.toThrow("forbidden");
    await expect(uploadStoreHeroImage(new FormData())).rejects.toThrow("forbidden");
    await expect(removeStoreHeroImage()).rejects.toThrow("forbidden");
    expect(prismaMock.storeType.update).not.toHaveBeenCalled();
  });
});

describe("setStoreTheme (superadmin only)", () => {
  it("rejects a BOUTIQUE_ADMIN", async () => {
    asBoutiqueAdmin("cosmetique");

    await expect(setStoreTheme("default")).rejects.toThrow("forbidden");
    expect(prismaMock.storeType.update).not.toHaveBeenCalled();
  });

  it("accepts a known theme preset from a SUPERADMIN", async () => {
    asSuperAdminScopedTo("cosmetique");
    prismaMock.storeType.update.mockResolvedValue({} as never);

    const result = await setStoreTheme("default");

    expect(result.error).toBeUndefined();
    expect(prismaMock.storeType.update).toHaveBeenCalledWith({
      where: { key: "cosmetique" },
      data: { themeId: "default", customThemeColor: null },
    });
  });

  it("rejects an unknown theme id", async () => {
    asSuperAdminScopedTo("cosmetique");

    const result = await setStoreTheme("not-a-real-theme");

    expect(result.error).toBe("invalid");
    expect(prismaMock.storeType.update).not.toHaveBeenCalled();
  });
});

describe("setCustomThemeColor / setColorMode (superadmin only)", () => {
  it("rejects a BOUTIQUE_ADMIN", async () => {
    asBoutiqueAdmin("cosmetique");

    await expect(setCustomThemeColor("#123456")).rejects.toThrow("forbidden");
    await expect(setColorMode("dark")).rejects.toThrow("forbidden");
    expect(prismaMock.storeType.update).not.toHaveBeenCalled();
  });

  it("accepts valid input from a SUPERADMIN", async () => {
    asSuperAdminScopedTo("cosmetique");
    prismaMock.storeType.update.mockResolvedValue({} as never);

    const colorResult = await setCustomThemeColor("#123456");
    const modeResult = await setColorMode("dark");

    expect(colorResult.error).toBeUndefined();
    expect(modeResult.error).toBeUndefined();
    expect(prismaMock.storeType.update).toHaveBeenCalledWith({
      where: { key: "cosmetique" },
      data: { themeId: "custom", customThemeColor: "#123456" },
    });
    expect(prismaMock.storeType.update).toHaveBeenCalledWith({
      where: { key: "cosmetique" },
      data: { colorMode: "dark" },
    });
  });

  it("rejects an invalid hex color and color mode", async () => {
    asSuperAdminScopedTo("cosmetique");

    expect((await setCustomThemeColor("not-a-color")).error).toBe("invalid");
    expect((await setColorMode("purple")).error).toBe("invalid");
    expect(prismaMock.storeType.update).not.toHaveBeenCalled();
  });
});

describe("setHeroVariant / setCardVariant / setFooterVariant (superadmin only)", () => {
  it("rejects a BOUTIQUE_ADMIN", async () => {
    asBoutiqueAdmin("cosmetique");

    await expect(setHeroVariant("fullbleed")).rejects.toThrow("forbidden");
    await expect(setCardVariant("cart")).rejects.toThrow("forbidden");
    await expect(setFooterVariant("centered")).rejects.toThrow("forbidden");
    expect(prismaMock.storeType.update).not.toHaveBeenCalled();
  });

  it("accepts a known variant from a SUPERADMIN", async () => {
    asSuperAdminScopedTo("cosmetique");
    prismaMock.storeType.update.mockResolvedValue({} as never);

    const heroResult = await setHeroVariant("fullbleed");
    const cardResult = await setCardVariant("cart");
    const footerResult = await setFooterVariant("centered");

    expect(heroResult.error).toBeUndefined();
    expect(cardResult.error).toBeUndefined();
    expect(footerResult.error).toBeUndefined();
    expect(prismaMock.storeType.update).toHaveBeenCalledWith({
      where: { key: "cosmetique" },
      data: { heroVariant: "fullbleed" },
    });
    expect(prismaMock.storeType.update).toHaveBeenCalledWith({
      where: { key: "cosmetique" },
      data: { cardVariant: "cart" },
    });
    expect(prismaMock.storeType.update).toHaveBeenCalledWith({
      where: { key: "cosmetique" },
      data: { footerVariant: "centered" },
    });
  });

  it("rejects an unknown variant", async () => {
    asSuperAdminScopedTo("cosmetique");

    const heroResult = await setHeroVariant("not-a-real-variant");
    const footerResult = await setFooterVariant("not-a-real-variant");

    expect(heroResult.error).toBe("invalid");
    expect(footerResult.error).toBe("invalid");
    expect(prismaMock.storeType.update).not.toHaveBeenCalled();
  });
});
