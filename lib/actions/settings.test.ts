import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaClientKnownRequestError } from "@/lib/generated/prisma/internal/prismaNamespace";

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
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import {
  updateBoutiqueSettings,
  setStoreTheme,
  setCustomThemeColor,
  setColorMode,
  setHeroVariant,
  setCardVariant,
  setFooterVariant,
  setProductType,
  createProductType,
  updateStoreDomain,
  updateLicenseExpiresAt,
  updateBoutiqueLicense,
  updateLicenseClientName,
  setCouponsEnabled,
  updateSolalContact,
} from "@/lib/actions/settings";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const createClientMock = createClient as unknown as Mock;
const cookiesMock = cookies as unknown as Mock;

// setStoreTheme/setHeroVariant/setCardVariant/etc. are superadmin-only but
// still scoped to "whichever boutique they're currently managing" — that
// resolution (requireAdminScope -> getAdminScope) reads the scope cookie
// and validates it against the real StoreType table, both mocked here the
// same way lib/shop/admin-scope.test.ts does.
const STORE_TYPES = [{ key: "cosmetique", label: "Cosmétique", createdAt: new Date() }];

function asSuperAdminScopedTo(productType: string) {
  asSuperAdmin();
  prismaMock.storeType.findMany.mockResolvedValue(STORE_TYPES as never);
  cookiesMock.mockResolvedValue({ get: () => ({ value: productType }) });
}

function collisionError() {
  return new PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
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

  it("rejects input missing the required whatsapp number", async () => {
    asBoutiqueAdmin();

    const result = await updateBoutiqueSettings({
      adminWhatsappNumber: "",
    });

    expect(result.error).toBe("invalid");
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

describe("setProductType (superadmin only)", () => {
  it("rejects a BOUTIQUE_ADMIN", async () => {
    asBoutiqueAdmin();

    await expect(setProductType("sport")).rejects.toThrow("forbidden");
    expect(prismaMock.storeSettings.upsert).not.toHaveBeenCalled();
  });

  it("switches the default boutique and seeds suggested categories", async () => {
    asSuperAdmin();
    prismaMock.storeType.findUnique.mockResolvedValue({ key: "sport" } as never);
    prismaMock.storeSettings.upsert.mockResolvedValue({} as never);
    prismaMock.category.createMany.mockResolvedValue({ count: 3 } as never);

    const result = await setProductType("sport");

    expect(result.error).toBeUndefined();
    expect(prismaMock.storeSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { productType: "sport" },
        create: { id: "singleton", productType: "sport" },
      }),
    );
    expect(prismaMock.category.createMany).toHaveBeenCalled();
  });

  it("rejects a productType that doesn't exist", async () => {
    asSuperAdmin();
    prismaMock.storeType.findUnique.mockResolvedValue(null);

    const result = await setProductType("does-not-exist");

    expect(result.error).toBe("invalid");
    expect(prismaMock.storeSettings.upsert).not.toHaveBeenCalled();
  });
});

describe("createProductType (superadmin only)", () => {
  it("rejects a BOUTIQUE_ADMIN", async () => {
    asBoutiqueAdmin();

    await expect(
      createProductType({ name: "Bijoux", categories: [] }),
    ).rejects.toThrow("forbidden");
    expect(prismaMock.storeType.create).not.toHaveBeenCalled();
  });

  it("creates a new boutique type with its categories", async () => {
    asSuperAdmin();
    prismaMock.storeType.create.mockResolvedValue({ key: "bijoux" } as never);
    prismaMock.category.createMany.mockResolvedValue({ count: 1 } as never);

    const result = await createProductType({
      name: "Bijoux",
      categories: ["Colliers"],
    });

    expect(result.error).toBeUndefined();
    expect(prismaMock.storeType.create).toHaveBeenCalledWith({
      data: { key: "bijoux", label: "Bijoux" },
    });
    expect(prismaMock.category.createMany).toHaveBeenCalledWith({
      data: [{ name: "Colliers", productType: "bijoux" }],
      skipDuplicates: true,
    });
  });

  it("rejects a reserved key", async () => {
    asSuperAdmin();

    const result = await createProductType({ name: "Admin", categories: [] });

    expect(result.error).toBe("reservedKey");
    expect(prismaMock.storeType.create).not.toHaveBeenCalled();
  });

  it("reports a duplicate key collision", async () => {
    asSuperAdmin();
    prismaMock.storeType.create.mockRejectedValue(collisionError());

    const result = await createProductType({ name: "Bijoux", categories: [] });

    expect(result.error).toBe("duplicateKey");
  });
});

describe("updateStoreDomain (superadmin only)", () => {
  it("rejects a BOUTIQUE_ADMIN", async () => {
    asBoutiqueAdmin();

    await expect(updateStoreDomain("sport", "sport.example.com")).rejects.toThrow(
      "forbidden",
    );
    expect(prismaMock.storeType.update).not.toHaveBeenCalled();
  });

  it("sets a custom domain for the given boutique", async () => {
    asSuperAdmin();
    prismaMock.storeType.update.mockResolvedValue({} as never);

    const result = await updateStoreDomain("sport", "sport.example.com");

    expect(result.error).toBeUndefined();
    expect(prismaMock.storeType.update).toHaveBeenCalledWith({
      where: { key: "sport" },
      data: { domain: "sport.example.com" },
    });
  });

  it("clears the domain when given an empty string", async () => {
    asSuperAdmin();
    prismaMock.storeType.update.mockResolvedValue({} as never);

    const result = await updateStoreDomain("sport", "");

    expect(result.error).toBeUndefined();
    expect(prismaMock.storeType.update).toHaveBeenCalledWith({
      where: { key: "sport" },
      data: { domain: null },
    });
  });

  it("reports a duplicate domain collision", async () => {
    asSuperAdmin();
    prismaMock.storeType.update.mockRejectedValue(collisionError());

    const result = await updateStoreDomain("sport", "taken.example.com");

    expect(result.error).toBe("duplicateDomain");
  });

  it("rejects a malformed domain", async () => {
    asSuperAdmin();

    const result = await updateStoreDomain("sport", "not a hostname!!");

    expect(result.error).toBe("invalid");
    expect(prismaMock.storeType.update).not.toHaveBeenCalled();
  });
});

describe("updateLicenseExpiresAt (superadmin only)", () => {
  it("rejects a BOUTIQUE_ADMIN", async () => {
    asBoutiqueAdmin();

    await expect(updateLicenseExpiresAt("sport", "2027-01-01")).rejects.toThrow(
      "forbidden",
    );
    expect(prismaMock.storeType.update).not.toHaveBeenCalled();
  });

  it("sets a valid expiration date", async () => {
    asSuperAdmin();
    prismaMock.storeType.update.mockResolvedValue({} as never);

    const result = await updateLicenseExpiresAt("sport", "2027-01-01");

    expect(result.error).toBeUndefined();
    expect(prismaMock.storeType.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: "sport" } }),
    );
  });

  it("clears the expiration date when given null", async () => {
    asSuperAdmin();
    prismaMock.storeType.update.mockResolvedValue({} as never);

    const result = await updateLicenseExpiresAt("sport", null);

    expect(result.error).toBeUndefined();
    expect(prismaMock.storeType.update).toHaveBeenCalledWith({
      where: { key: "sport" },
      data: { licenseExpiresAt: null },
    });
  });

  it("rejects an unparseable date", async () => {
    asSuperAdmin();

    const result = await updateLicenseExpiresAt("sport", "not-a-date");

    expect(result.error).toBe("invalid");
    expect(prismaMock.storeType.update).not.toHaveBeenCalled();
  });
});

describe("updateBoutiqueLicense (superadmin only)", () => {
  it("rejects a BOUTIQUE_ADMIN", async () => {
    asBoutiqueAdmin();

    await expect(
      updateBoutiqueLicense("sport", { licenseType: "YEARLY", licenseStatus: "ACTIVE" }),
    ).rejects.toThrow("forbidden");
    expect(prismaMock.storeType.update).not.toHaveBeenCalled();
  });

  it("rejects an invalid licenseType/licenseStatus", async () => {
    asSuperAdmin();

    const result = await updateBoutiqueLicense("sport", {
      licenseType: "WEEKLY",
      licenseStatus: "ACTIVE",
    });

    expect(result.error).toBe("invalid");
    expect(prismaMock.storeType.update).not.toHaveBeenCalled();
  });

  it("stamps licenseStartedAt when the plan changes", async () => {
    asSuperAdmin();
    prismaMock.storeType.findUnique.mockResolvedValue({
      licenseType: "MONTHLY",
      licenseStatus: "ACTIVE",
    } as never);
    prismaMock.storeType.update.mockResolvedValue({} as never);

    const result = await updateBoutiqueLicense("sport", {
      licenseType: "YEARLY",
      licenseStatus: "ACTIVE",
    });

    expect(result.error).toBeUndefined();
    expect(prismaMock.storeType.update).toHaveBeenCalledWith({
      where: { key: "sport" },
      data: expect.objectContaining({
        licenseType: "YEARLY",
        licenseStatus: "ACTIVE",
        licenseStartedAt: expect.any(Date),
      }),
    });
  });

  it("stamps licenseStartedAt when reactivating from SUSPENDED", async () => {
    asSuperAdmin();
    prismaMock.storeType.findUnique.mockResolvedValue({
      licenseType: "MONTHLY",
      licenseStatus: "SUSPENDED",
    } as never);
    prismaMock.storeType.update.mockResolvedValue({} as never);

    await updateBoutiqueLicense("sport", { licenseType: "MONTHLY", licenseStatus: "ACTIVE" });

    expect(prismaMock.storeType.update).toHaveBeenCalledWith({
      where: { key: "sport" },
      data: expect.objectContaining({ licenseStartedAt: expect.any(Date) }),
    });
  });

  it("does not touch licenseStartedAt for an unrelated status change", async () => {
    asSuperAdmin();
    prismaMock.storeType.findUnique.mockResolvedValue({
      licenseType: "MONTHLY",
      licenseStatus: "ACTIVE",
    } as never);
    prismaMock.storeType.update.mockResolvedValue({} as never);

    await updateBoutiqueLicense("sport", { licenseType: "MONTHLY", licenseStatus: "SUSPENDED" });

    expect(prismaMock.storeType.update).toHaveBeenCalledWith({
      where: { key: "sport" },
      data: { licenseType: "MONTHLY", licenseStatus: "SUSPENDED" },
    });
  });

  it("reports a boutique that no longer exists", async () => {
    asSuperAdmin();
    prismaMock.storeType.findUnique.mockResolvedValue(null);

    const result = await updateBoutiqueLicense("sport", {
      licenseType: "MONTHLY",
      licenseStatus: "ACTIVE",
    });

    expect(result.error).toBe("notFound");
    expect(prismaMock.storeType.update).not.toHaveBeenCalled();
  });
});

describe("updateLicenseClientName (superadmin only)", () => {
  it("rejects a BOUTIQUE_ADMIN", async () => {
    asBoutiqueAdmin();

    await expect(
      updateLicenseClientName("sport", "Boutique Aïcha SARL"),
    ).rejects.toThrow("forbidden");
    expect(prismaMock.storeType.update).not.toHaveBeenCalled();
  });

  it("sets the client's legal name", async () => {
    asSuperAdmin();
    prismaMock.storeType.update.mockResolvedValue({} as never);

    const result = await updateLicenseClientName("sport", "Boutique Aïcha SARL");

    expect(result.error).toBeUndefined();
    expect(prismaMock.storeType.update).toHaveBeenCalledWith({
      where: { key: "sport" },
      data: { licenseClientName: "Boutique Aïcha SARL" },
    });
  });

  it("clears the name back to null on an empty string", async () => {
    asSuperAdmin();
    prismaMock.storeType.update.mockResolvedValue({} as never);

    const result = await updateLicenseClientName("sport", "");

    expect(result.error).toBeUndefined();
    expect(prismaMock.storeType.update).toHaveBeenCalledWith({
      where: { key: "sport" },
      data: { licenseClientName: null },
    });
  });

  it("rejects a name over the length limit", async () => {
    asSuperAdmin();

    const result = await updateLicenseClientName("sport", "a".repeat(201));

    expect(result.error).toBe("invalid");
    expect(prismaMock.storeType.update).not.toHaveBeenCalled();
  });
});

describe("setCouponsEnabled (superadmin only)", () => {
  it("rejects a BOUTIQUE_ADMIN", async () => {
    asBoutiqueAdmin();

    await expect(setCouponsEnabled("sport", false)).rejects.toThrow("forbidden");
    expect(prismaMock.storeType.update).not.toHaveBeenCalled();
  });

  it("toggles the flag for a superadmin", async () => {
    asSuperAdmin();
    prismaMock.storeType.update.mockResolvedValue({} as never);

    const result = await setCouponsEnabled("sport", false);

    expect(result.error).toBeUndefined();
    expect(prismaMock.storeType.update).toHaveBeenCalledWith({
      where: { key: "sport" },
      data: { couponsEnabled: false },
    });
  });
});

describe("updateSolalContact (superadmin only)", () => {
  const validInput = {
    address: "12 rue du Port, Nouakchott",
    phone: "+222 22 22 22 22",
    email: "contact@solal.example",
    website: "https://solal.example",
  };

  it("rejects a BOUTIQUE_ADMIN", async () => {
    asBoutiqueAdmin();

    await expect(updateSolalContact(validInput)).rejects.toThrow("forbidden");
    expect(prismaMock.solalContact.upsert).not.toHaveBeenCalled();
  });

  it("rejects an invalid email", async () => {
    asSuperAdmin();

    const result = await updateSolalContact({ ...validInput, email: "not-an-email" });

    expect(result.error).toBe("invalid");
    expect(prismaMock.solalContact.upsert).not.toHaveBeenCalled();
  });

  it("upserts the singleton row for a superadmin", async () => {
    asSuperAdmin();
    prismaMock.solalContact.upsert.mockResolvedValue({} as never);

    const result = await updateSolalContact(validInput);

    expect(result.error).toBeUndefined();
    expect(prismaMock.solalContact.upsert).toHaveBeenCalledWith({
      where: { id: "singleton" },
      update: validInput,
      create: { id: "singleton", ...validInput },
    });
  });

  it("accepts every field left blank", async () => {
    asSuperAdmin();
    prismaMock.solalContact.upsert.mockResolvedValue({} as never);

    const blank = { address: "", phone: "", email: "", website: "" };
    const result = await updateSolalContact(blank);

    expect(result.error).toBeUndefined();
    expect(prismaMock.solalContact.upsert).toHaveBeenCalledWith({
      where: { id: "singleton" },
      update: blank,
      create: { id: "singleton", ...blank },
    });
  });
});
