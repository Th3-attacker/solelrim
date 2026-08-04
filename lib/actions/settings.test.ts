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

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import {
  updateBoutiqueSettings,
  setStoreTheme,
  setProductType,
  createProductType,
  updateStoreDomain,
  updateLicenseExpiresAt,
} from "@/lib/actions/settings";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const createClientMock = createClient as unknown as Mock;

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

describe("setStoreTheme", () => {
  it("accepts a known theme preset", async () => {
    asBoutiqueAdmin("cosmetique");
    prismaMock.storeType.update.mockResolvedValue({} as never);

    const result = await setStoreTheme("default");

    expect(result.error).toBeUndefined();
    expect(prismaMock.storeType.update).toHaveBeenCalledWith({
      where: { key: "cosmetique" },
      data: { themeId: "default" },
    });
  });

  it("rejects an unknown theme id", async () => {
    asBoutiqueAdmin();

    const result = await setStoreTheme("not-a-real-theme");

    expect(result.error).toBe("invalid");
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
