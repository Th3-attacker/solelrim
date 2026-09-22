import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/auth/admin", () => ({
  getCurrentAdmin: vi.fn(),
}));
vi.mock("@/lib/queries/settings", () => ({
  getStoreSettings: vi.fn(),
  getStoreTypes: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { storeType: { findUnique: vi.fn() } },
}));

import { getCurrentAdmin } from "@/lib/auth/admin";
import { getStoreSettings, getStoreTypes } from "@/lib/queries/settings";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  getAdminScope,
  requireAdminScope,
  requireSuperAdminScope,
  requireWritableAdminScope,
} from "@/lib/shop/admin-scope";

const getCurrentAdminMock = getCurrentAdmin as unknown as Mock;
const getStoreSettingsMock = getStoreSettings as unknown as Mock;
const getStoreTypesMock = getStoreTypes as unknown as Mock;
const cookiesMock = cookies as unknown as Mock;
const storeTypeFindUniqueMock = prisma.storeType.findUnique as unknown as Mock;

const STORE_TYPES = [
  { key: "sport", label: "Sport", themeId: "default", createdAt: new Date() },
  { key: "cosmetique", label: "Cosmétique", themeId: "rose", createdAt: new Date() },
];

function cookieValue(value: string | undefined) {
  cookiesMock.mockResolvedValue({
    get: () => (value ? { value } : undefined),
  });
}

beforeEach(() => {
  getCurrentAdminMock.mockReset();
  getStoreSettingsMock.mockReset();
  getStoreTypesMock.mockReset();
  cookiesMock.mockReset();
  storeTypeFindUniqueMock.mockReset();
  getStoreTypesMock.mockResolvedValue(STORE_TYPES);
});

describe("requireAdminScope", () => {
  it("locks a BOUTIQUE_ADMIN to their own boutique, never consulting the cookie", async () => {
    getCurrentAdminMock.mockResolvedValue({ role: "BOUTIQUE_ADMIN", productType: "sport" });
    cookieValue("cosmetique");

    const result = await requireAdminScope();

    expect(result.productType).toBe("sport");
    expect(cookiesMock).not.toHaveBeenCalled();
  });

  it("lets a SUPERADMIN act on whichever boutique the cookie selects", async () => {
    getCurrentAdminMock.mockResolvedValue({ role: "SUPERADMIN", productType: null });
    cookieValue("cosmetique");

    const result = await requireAdminScope();

    expect(result.productType).toBe("cosmetique");
  });
});

describe("requireSuperAdminScope", () => {
  it("rejects a BOUTIQUE_ADMIN", async () => {
    getCurrentAdminMock.mockResolvedValue({ role: "BOUTIQUE_ADMIN", productType: "sport" });

    await expect(requireSuperAdminScope()).rejects.toThrow("forbidden");
  });

  it("resolves the SUPERADMIN's current scope, same as requireAdminScope", async () => {
    getCurrentAdminMock.mockResolvedValue({ role: "SUPERADMIN", productType: null });
    cookieValue("cosmetique");

    const result = await requireSuperAdminScope();

    expect(result.productType).toBe("cosmetique");
  });
});

describe("getAdminScope", () => {
  it("ignores a cookie value that doesn't match any known boutique", async () => {
    getCurrentAdminMock.mockResolvedValue({ role: "SUPERADMIN", productType: null });
    cookieValue("does-not-exist");
    getStoreSettingsMock.mockResolvedValue({ productType: "cosmetique" });

    const result = await getAdminScope();

    expect(result).toBe("cosmetique");
  });

  it("falls back to the public live boutique when no cookie is set", async () => {
    getCurrentAdminMock.mockResolvedValue({ role: "SUPERADMIN", productType: null });
    cookieValue(undefined);
    getStoreSettingsMock.mockResolvedValue({ productType: "cosmetique" });

    const result = await getAdminScope();

    expect(result).toBe("cosmetique");
  });

  it("falls back to the first StoreType when neither the cookie nor the public type resolve", async () => {
    getCurrentAdminMock.mockResolvedValue({ role: "SUPERADMIN", productType: null });
    cookieValue(undefined);
    getStoreSettingsMock.mockResolvedValue({ productType: "does-not-exist" });

    const result = await getAdminScope();

    expect(result).toBe("sport");
  });

  it("falls back to the cookie/public-type flow when the caller isn't a recognized admin at all", async () => {
    getCurrentAdminMock.mockRejectedValue(new Error("unauthorized"));
    cookieValue("sport");

    const result = await getAdminScope();

    expect(result).toBe("sport");
  });
});

describe("requireWritableAdminScope", () => {
  it("allows a BOUTIQUE_ADMIN whose boutique has no license row at all (defensive default)", async () => {
    getCurrentAdminMock.mockResolvedValue({ role: "BOUTIQUE_ADMIN", productType: "sport" });
    storeTypeFindUniqueMock.mockResolvedValue(null);

    const result = await requireWritableAdminScope();

    expect(result.productType).toBe("sport");
  });

  it("allows a BOUTIQUE_ADMIN whose boutique license is ACTIVE", async () => {
    getCurrentAdminMock.mockResolvedValue({ role: "BOUTIQUE_ADMIN", productType: "sport" });
    storeTypeFindUniqueMock.mockResolvedValue({
      licenseType: "MONTHLY",
      licenseStatus: "ACTIVE",
      licenseExpiresAt: null,
    });

    const result = await requireWritableAdminScope();

    expect(result.productType).toBe("sport");
  });

  it("rejects a BOUTIQUE_ADMIN whose boutique is SUSPENDED", async () => {
    getCurrentAdminMock.mockResolvedValue({ role: "BOUTIQUE_ADMIN", productType: "sport" });
    storeTypeFindUniqueMock.mockResolvedValue({
      licenseType: "MONTHLY",
      licenseStatus: "SUSPENDED",
      licenseExpiresAt: null,
    });

    await expect(requireWritableAdminScope()).rejects.toThrow("licenseBlocked");
  });

  it("rejects a BOUTIQUE_ADMIN whose boutique license has EXPIRED", async () => {
    getCurrentAdminMock.mockResolvedValue({ role: "BOUTIQUE_ADMIN", productType: "sport" });
    storeTypeFindUniqueMock.mockResolvedValue({
      licenseType: "MONTHLY",
      licenseStatus: "ACTIVE",
      licenseExpiresAt: new Date("2000-01-01"),
    });

    await expect(requireWritableAdminScope()).rejects.toThrow("licenseBlocked");
  });

  it("never blocks a SUPERADMIN, even when the boutique they're scoped to is suspended", async () => {
    getCurrentAdminMock.mockResolvedValue({ role: "SUPERADMIN", productType: null });
    cookieValue("cosmetique");
    // No storeType lookup should even be needed for a SUPERADMIN.
    storeTypeFindUniqueMock.mockResolvedValue({
      licenseType: "MONTHLY",
      licenseStatus: "SUSPENDED",
      licenseExpiresAt: null,
    });

    const result = await requireWritableAdminScope();

    expect(result.productType).toBe("cosmetique");
    expect(storeTypeFindUniqueMock).not.toHaveBeenCalled();
  });
});
