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
}));

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createBoutiqueAdmin,
  deleteBoutiqueAdmin,
  setAdminCanManageAppearance,
  setAdminMfaRequired,
} from "@/lib/actions/admin-users";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const createClientMock = createClient as unknown as Mock;
const createAdminClientMock = createAdminClient as unknown as Mock;

// Mirrors lib/actions/orders.test.ts: requireSuperAdmin() (via
// getCurrentAdmin()) resolves straight from this AdminUser row, no
// cookies()/getStoreTypes() lookups needed for either role here.
function asBoutiqueAdmin() {
  createClientMock.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-1" } } }) },
  });
  prismaMock.adminUser.findUnique.mockResolvedValue({
    id: "admin-user-1",
    supabaseUserId: "admin-1",
    role: "BOUTIQUE_ADMIN",
    productType: "cosmetique",
    canManageAppearance: false,
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
    canManageAppearance: false,
    createdAt: new Date(),
  } as never);
}

beforeEach(() => {
  mockReset(prismaMock);
  createClientMock.mockReset();
  createAdminClientMock.mockReset();
});

describe("createBoutiqueAdmin", () => {
  it("rejects a BOUTIQUE_ADMIN caller", async () => {
    asBoutiqueAdmin();

    await expect(
      createBoutiqueAdmin({
        email: "new@example.com",
        password: "longenough",
        productType: "cosmetique",
      }),
    ).rejects.toThrow("forbidden");
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("rejects malformed input", async () => {
    asSuperAdmin();

    const result = await createBoutiqueAdmin({
      email: "not-an-email",
      password: "short",
      productType: "",
    });

    expect(result.error).toBe("invalid");
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("rejects a productType that doesn't exist", async () => {
    asSuperAdmin();
    prismaMock.storeType.findUnique.mockResolvedValue(null);

    const result = await createBoutiqueAdmin({
      email: "new@example.com",
      password: "longenough",
      productType: "does-not-exist",
    });

    expect(result.error).toBe("invalid");
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("reports createFailed when Supabase user creation errors", async () => {
    asSuperAdmin();
    prismaMock.storeType.findUnique.mockResolvedValue({ key: "cosmetique" } as never);
    const createUser = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    createAdminClientMock.mockReturnValue({ auth: { admin: { createUser } } });

    const result = await createBoutiqueAdmin({
      email: "new@example.com",
      password: "longenough",
      productType: "cosmetique",
    });

    expect(result.error).toBe("createFailed");
    expect(prismaMock.adminUser.create).not.toHaveBeenCalled();
  });

  it("reports emailExists distinctly when the email is already a Supabase user", async () => {
    asSuperAdmin();
    prismaMock.storeType.findUnique.mockResolvedValue({ key: "cosmetique" } as never);
    const createUser = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: "email_exists", message: "..." } });
    createAdminClientMock.mockReturnValue({ auth: { admin: { createUser } } });

    const result = await createBoutiqueAdmin({
      email: "taken@example.com",
      password: "longenough",
      productType: "cosmetique",
    });

    expect(result.error).toBe("emailExists");
    expect(prismaMock.adminUser.create).not.toHaveBeenCalled();
  });

  it("creates the Supabase user and the AdminUser row on success", async () => {
    asSuperAdmin();
    prismaMock.storeType.findUnique.mockResolvedValue({ key: "cosmetique" } as never);
    const createUser = vi
      .fn()
      .mockResolvedValue({ data: { user: { id: "new-supabase-id" } }, error: null });
    const deleteUser = vi.fn().mockResolvedValue({});
    createAdminClientMock.mockReturnValue({ auth: { admin: { createUser, deleteUser } } });
    prismaMock.adminUser.create.mockResolvedValue({} as never);

    const result = await createBoutiqueAdmin({
      email: "new@example.com",
      password: "longenough",
      productType: "cosmetique",
      canManageAppearance: true,
    });

    expect(result.error).toBeUndefined();
    expect(prismaMock.adminUser.create).toHaveBeenCalledWith({
      data: {
        supabaseUserId: "new-supabase-id",
        role: "BOUTIQUE_ADMIN",
        productType: "cosmetique",
        canManageAppearance: true,
      },
    });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("rolls back the orphaned Supabase user when the AdminUser insert fails", async () => {
    asSuperAdmin();
    prismaMock.storeType.findUnique.mockResolvedValue({ key: "cosmetique" } as never);
    const createUser = vi
      .fn()
      .mockResolvedValue({ data: { user: { id: "new-supabase-id" } }, error: null });
    const deleteUser = vi.fn().mockResolvedValue({});
    createAdminClientMock.mockReturnValue({ auth: { admin: { createUser, deleteUser } } });
    prismaMock.adminUser.create.mockRejectedValue(new Error("db down"));

    await expect(
      createBoutiqueAdmin({
        email: "new@example.com",
        password: "longenough",
        productType: "cosmetique",
      }),
    ).rejects.toThrow("db down");

    expect(deleteUser).toHaveBeenCalledWith("new-supabase-id");
  });
});

describe("deleteBoutiqueAdmin", () => {
  it("rejects a BOUTIQUE_ADMIN caller", async () => {
    asBoutiqueAdmin();

    await expect(deleteBoutiqueAdmin("target-id")).rejects.toThrow("forbidden");
    expect(prismaMock.adminUser.delete).not.toHaveBeenCalled();
  });

  it("rejects an unknown admin id", async () => {
    asSuperAdmin();
    prismaMock.adminUser.findUnique.mockResolvedValueOnce({
      id: "admin-user-2",
      supabaseUserId: "super-1",
      role: "SUPERADMIN",
      productType: null,
      createdAt: new Date(),
    } as never);
    // Second call (the target lookup inside the action) resolves null.
    prismaMock.adminUser.findUnique.mockResolvedValueOnce(null);

    const result = await deleteBoutiqueAdmin("does-not-exist");

    expect(result.error).toBe("invalid");
    expect(prismaMock.adminUser.delete).not.toHaveBeenCalled();
  });

  it("refuses to target a SUPERADMIN row", async () => {
    asSuperAdmin();
    prismaMock.adminUser.findUnique.mockResolvedValueOnce({
      id: "admin-user-2",
      supabaseUserId: "super-1",
      role: "SUPERADMIN",
      productType: null,
      createdAt: new Date(),
    } as never);
    prismaMock.adminUser.findUnique.mockResolvedValueOnce({
      id: "other-super",
      supabaseUserId: "super-2",
      role: "SUPERADMIN",
      productType: null,
      createdAt: new Date(),
    } as never);

    const result = await deleteBoutiqueAdmin("other-super");

    expect(result.error).toBe("invalid");
    expect(prismaMock.adminUser.delete).not.toHaveBeenCalled();
  });

  it("deletes the Supabase account and the AdminUser row for a BOUTIQUE_ADMIN", async () => {
    asSuperAdmin();
    prismaMock.adminUser.findUnique.mockResolvedValueOnce({
      id: "admin-user-2",
      supabaseUserId: "super-1",
      role: "SUPERADMIN",
      productType: null,
      createdAt: new Date(),
    } as never);
    prismaMock.adminUser.findUnique.mockResolvedValueOnce({
      id: "target-id",
      supabaseUserId: "target-supabase-id",
      role: "BOUTIQUE_ADMIN",
      productType: "cosmetique",
      createdAt: new Date(),
    } as never);
    const deleteUser = vi.fn().mockResolvedValue({});
    createAdminClientMock.mockReturnValue({ auth: { admin: { deleteUser } } });
    prismaMock.adminUser.delete.mockResolvedValue({} as never);

    const result = await deleteBoutiqueAdmin("target-id");

    expect(result.error).toBeUndefined();
    expect(deleteUser).toHaveBeenCalledWith("target-supabase-id");
    expect(prismaMock.adminUser.delete).toHaveBeenCalledWith({ where: { id: "target-id" } });
  });
});

describe("setAdminCanManageAppearance", () => {
  it("rejects a BOUTIQUE_ADMIN caller", async () => {
    asBoutiqueAdmin();

    await expect(setAdminCanManageAppearance("target-id", true)).rejects.toThrow(
      "forbidden",
    );
    expect(prismaMock.adminUser.update).not.toHaveBeenCalled();
  });

  it("refuses to target a SUPERADMIN row", async () => {
    asSuperAdmin();
    prismaMock.adminUser.findUnique.mockResolvedValueOnce({
      id: "admin-user-2",
      supabaseUserId: "super-1",
      role: "SUPERADMIN",
      productType: null,
      createdAt: new Date(),
    } as never);
    prismaMock.adminUser.findUnique.mockResolvedValueOnce({
      id: "other-super",
      role: "SUPERADMIN",
      productType: null,
      createdAt: new Date(),
    } as never);

    const result = await setAdminCanManageAppearance("other-super", true);

    expect(result.error).toBe("invalid");
    expect(prismaMock.adminUser.update).not.toHaveBeenCalled();
  });

  it("grants the exception to a BOUTIQUE_ADMIN", async () => {
    asSuperAdmin();
    prismaMock.adminUser.findUnique.mockResolvedValueOnce({
      id: "admin-user-2",
      supabaseUserId: "super-1",
      role: "SUPERADMIN",
      productType: null,
      createdAt: new Date(),
    } as never);
    prismaMock.adminUser.findUnique.mockResolvedValueOnce({
      id: "target-id",
      role: "BOUTIQUE_ADMIN",
      productType: "cosmetique",
      createdAt: new Date(),
    } as never);
    prismaMock.adminUser.update.mockResolvedValue({} as never);

    const result = await setAdminCanManageAppearance("target-id", true);

    expect(result.error).toBeUndefined();
    expect(prismaMock.adminUser.update).toHaveBeenCalledWith({
      where: { id: "target-id" },
      data: { canManageAppearance: true },
    });
  });
});

describe("setAdminMfaRequired", () => {
  it("rejects a BOUTIQUE_ADMIN caller", async () => {
    asBoutiqueAdmin();

    await expect(setAdminMfaRequired("target-id", true)).rejects.toThrow("forbidden");
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("refuses to target a SUPERADMIN row", async () => {
    asSuperAdmin();
    prismaMock.adminUser.findUnique.mockResolvedValueOnce({
      id: "admin-user-2",
      supabaseUserId: "super-1",
      role: "SUPERADMIN",
      productType: null,
      createdAt: new Date(),
    } as never);
    prismaMock.adminUser.findUnique.mockResolvedValueOnce({
      id: "other-super",
      role: "SUPERADMIN",
      productType: null,
      createdAt: new Date(),
    } as never);

    const result = await setAdminMfaRequired("other-super", true);

    expect(result.error).toBe("invalid");
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("writes the requirement to Supabase Auth's app_metadata for a BOUTIQUE_ADMIN", async () => {
    asSuperAdmin();
    prismaMock.adminUser.findUnique.mockResolvedValueOnce({
      id: "admin-user-2",
      supabaseUserId: "super-1",
      role: "SUPERADMIN",
      productType: null,
      createdAt: new Date(),
    } as never);
    prismaMock.adminUser.findUnique.mockResolvedValueOnce({
      id: "target-id",
      supabaseUserId: "target-supabase-id",
      role: "BOUTIQUE_ADMIN",
      productType: "cosmetique",
      createdAt: new Date(),
    } as never);

    const updateUserById = vi.fn().mockResolvedValue({ error: null });
    createAdminClientMock.mockReturnValue({ auth: { admin: { updateUserById } } });

    const result = await setAdminMfaRequired("target-id", true);

    expect(result.error).toBeUndefined();
    expect(updateUserById).toHaveBeenCalledWith("target-supabase-id", {
      app_metadata: { mfa_required: true },
    });
  });

  it("surfaces a Supabase update failure", async () => {
    asSuperAdmin();
    prismaMock.adminUser.findUnique.mockResolvedValueOnce({
      id: "admin-user-2",
      supabaseUserId: "super-1",
      role: "SUPERADMIN",
      productType: null,
      createdAt: new Date(),
    } as never);
    prismaMock.adminUser.findUnique.mockResolvedValueOnce({
      id: "target-id",
      supabaseUserId: "target-supabase-id",
      role: "BOUTIQUE_ADMIN",
      productType: "cosmetique",
      createdAt: new Date(),
    } as never);

    createAdminClientMock.mockReturnValue({
      auth: {
        admin: {
          updateUserById: vi.fn().mockResolvedValue({ error: { message: "nope" } }),
        },
      },
    });

    const result = await setAdminMfaRequired("target-id", true);

    expect(result).toEqual({ error: "updateFailed" });
  });
});
