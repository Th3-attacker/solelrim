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
import { createSeller, deleteSeller, setSellerQuota } from "@/lib/actions/sellers";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const createClientMock = createClient as unknown as Mock;
const createAdminClientMock = createAdminClient as unknown as Mock;

const VALID_INPUT = { email: "vendeur@example.com", password: "longenough" };

function signedInAs(role: "SUPERADMIN" | "BOUTIQUE_ADMIN" | "SELLER") {
  createClientMock.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "auth-1" } } }) },
  });
  prismaMock.adminUser.findUnique.mockResolvedValue({
    id: "admin-user-1",
    supabaseUserId: "auth-1",
    role,
    productType: role === "SUPERADMIN" ? null : "cosmetique",
    canManageAppearance: false,
    createdAt: new Date(),
  } as never);
}

function supabaseAdmin() {
  const auth = {
    admin: {
      createUser: vi.fn().mockResolvedValue({ data: { user: { id: "new-seller" } }, error: null }),
      deleteUser: vi.fn().mockResolvedValue({ error: null }),
    },
  };
  createAdminClientMock.mockReturnValue({ auth });
  return auth.admin;
}

beforeEach(() => {
  mockReset(prismaMock);
  createClientMock.mockReset();
  createAdminClientMock.mockReset();
  // Serves both the license check (requireWritableAdminScope) and the
  // seller-quota lookup — an active, unrestricted boutique allowing 2.
  prismaMock.storeType.findUnique.mockResolvedValue({
    licenseType: "MONTHLY",
    licenseStatus: "ACTIVE",
    licenseExpiresAt: null,
    sellerQuota: 2,
  } as never);
  prismaMock.$transaction.mockImplementation((cb) =>
    (cb as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock),
  );
  prismaMock.$queryRaw.mockResolvedValue([{ sellerQuota: 2 }] as never);
});

describe("createSeller", () => {
  it("rejects a SELLER caller before touching Supabase", async () => {
    signedInAs("SELLER");
    const admin = supabaseAdmin();

    await expect(createSeller(VALID_INPUT)).rejects.toThrow("forbidden");
    expect(admin.createUser).not.toHaveBeenCalled();
  });

  it("rejects malformed input", async () => {
    signedInAs("BOUTIQUE_ADMIN");
    const admin = supabaseAdmin();

    const result = await createSeller({ email: "not-an-email", password: "short" });

    expect(result.error).toBe("invalid");
    expect(admin.createUser).not.toHaveBeenCalled();
  });

  it("refuses once the quota is full, without creating any account", async () => {
    signedInAs("BOUTIQUE_ADMIN");
    const admin = supabaseAdmin();
    prismaMock.adminUser.count.mockResolvedValue(2);

    const result = await createSeller(VALID_INPUT);

    expect(result.error).toBe("quotaReached");
    expect(admin.createUser).not.toHaveBeenCalled();
  });

  it("creates a SELLER in the caller's own boutique, ignoring any boutique in the input", async () => {
    signedInAs("BOUTIQUE_ADMIN");
    const admin = supabaseAdmin();
    prismaMock.adminUser.count.mockResolvedValue(1);
    prismaMock.adminUser.create.mockResolvedValue({} as never);

    const result = await createSeller({ ...VALID_INPUT, productType: "sport" });

    expect(result.error).toBeUndefined();
    expect(prismaMock.adminUser.create).toHaveBeenCalledWith({
      data: { supabaseUserId: "new-seller", role: "SELLER", productType: "cosmetique" },
    });
    // proxy.ts routes on this without a DB lookup.
    expect(admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ app_metadata: { role: "SELLER" } }),
    );
  });

  it("loses a concurrent race cleanly: re-checks under lock and deletes the new account", async () => {
    signedInAs("BOUTIQUE_ADMIN");
    const admin = supabaseAdmin();
    // Early check sees room (1 of 2); by the locked re-check another
    // request has filled the last seat.
    prismaMock.adminUser.count.mockResolvedValueOnce(1).mockResolvedValueOnce(2);

    const result = await createSeller(VALID_INPUT);

    expect(result.error).toBe("quotaReached");
    expect(prismaMock.adminUser.create).not.toHaveBeenCalled();
    expect(admin.deleteUser).toHaveBeenCalledWith("new-seller");
  });

  it("reports emailExists when the email already has an account", async () => {
    signedInAs("BOUTIQUE_ADMIN");
    const admin = supabaseAdmin();
    admin.createUser.mockResolvedValue({ data: { user: null }, error: { code: "email_exists" } });
    prismaMock.adminUser.count.mockResolvedValue(0);

    const result = await createSeller(VALID_INPUT);

    expect(result.error).toBe("emailExists");
    expect(prismaMock.adminUser.create).not.toHaveBeenCalled();
  });
});

describe("deleteSeller", () => {
  it("rejects a SELLER caller", async () => {
    signedInAs("SELLER");
    supabaseAdmin();

    await expect(deleteSeller("seller-1")).rejects.toThrow("forbidden");
    expect(prismaMock.adminUser.delete).not.toHaveBeenCalled();
  });

  it("only looks up sellers of the caller's own boutique", async () => {
    signedInAs("BOUTIQUE_ADMIN");
    supabaseAdmin();
    prismaMock.adminUser.findFirst.mockResolvedValue(null);

    const result = await deleteSeller("other-boutique-seller");

    expect(result.error).toBe("notFound");
    expect(prismaMock.adminUser.findFirst).toHaveBeenCalledWith({
      where: { id: "other-boutique-seller", role: "SELLER", productType: "cosmetique" },
    });
    expect(prismaMock.adminUser.delete).not.toHaveBeenCalled();
  });

  it("refuses while the seller's till is still open", async () => {
    signedInAs("BOUTIQUE_ADMIN");
    const admin = supabaseAdmin();
    prismaMock.adminUser.findFirst.mockResolvedValue({
      id: "seller-1",
      supabaseUserId: "auth-seller-1",
    } as never);
    prismaMock.cashSession.findFirst.mockResolvedValue({ id: "session-1" } as never);

    const result = await deleteSeller("seller-1");

    expect(result.error).toBe("hasOpenSession");
    expect(admin.deleteUser).not.toHaveBeenCalled();
    expect(prismaMock.adminUser.delete).not.toHaveBeenCalled();
  });

  it("deletes the Supabase account and the AdminUser row", async () => {
    signedInAs("BOUTIQUE_ADMIN");
    const admin = supabaseAdmin();
    prismaMock.adminUser.findFirst.mockResolvedValue({
      id: "seller-1",
      supabaseUserId: "seller-auth-1",
    } as never);
    prismaMock.adminUser.delete.mockResolvedValue({} as never);

    const result = await deleteSeller("seller-1");

    expect(result.error).toBeUndefined();
    expect(admin.deleteUser).toHaveBeenCalledWith("seller-auth-1");
    expect(prismaMock.adminUser.delete).toHaveBeenCalledWith({ where: { id: "seller-1" } });
  });

  it("keeps the AdminUser row when the login couldn't be deleted, so it can be retried", async () => {
    signedInAs("BOUTIQUE_ADMIN");
    const admin = supabaseAdmin();
    admin.deleteUser.mockResolvedValue({ error: { code: "unexpected_failure" } });
    prismaMock.adminUser.findFirst.mockResolvedValue({
      id: "seller-1",
      supabaseUserId: "seller-auth-1",
    } as never);

    const result = await deleteSeller("seller-1");

    expect(result.error).toBe("deleteFailed");
    expect(prismaMock.adminUser.delete).not.toHaveBeenCalled();
  });

  it("still removes the row when the login was already gone", async () => {
    signedInAs("BOUTIQUE_ADMIN");
    const admin = supabaseAdmin();
    admin.deleteUser.mockResolvedValue({ error: { code: "user_not_found" } });
    prismaMock.adminUser.findFirst.mockResolvedValue({
      id: "seller-1",
      supabaseUserId: "seller-auth-1",
    } as never);
    prismaMock.adminUser.delete.mockResolvedValue({} as never);

    const result = await deleteSeller("seller-1");

    expect(result.error).toBeUndefined();
    expect(prismaMock.adminUser.delete).toHaveBeenCalledWith({ where: { id: "seller-1" } });
  });
});

describe("setSellerQuota", () => {
  it("rejects a BOUTIQUE_ADMIN — only a superadmin can raise the quota", async () => {
    signedInAs("BOUTIQUE_ADMIN");

    await expect(setSellerQuota("cosmetique", 5)).rejects.toThrow("forbidden");
    expect(prismaMock.storeType.updateMany).not.toHaveBeenCalled();
  });

  it.each([-1, 51, 1.5, Number.NaN])("rejects an invalid quota (%s)", async (quota) => {
    signedInAs("SUPERADMIN");

    const result = await setSellerQuota("cosmetique", quota);

    expect(result.error).toBe("invalid");
    expect(prismaMock.storeType.updateMany).not.toHaveBeenCalled();
  });

  it("updates the quota for a superadmin", async () => {
    signedInAs("SUPERADMIN");
    prismaMock.storeType.updateMany.mockResolvedValue({ count: 1 } as never);

    const result = await setSellerQuota("cosmetique", 5);

    expect(result.error).toBeUndefined();
    expect(prismaMock.storeType.updateMany).toHaveBeenCalledWith({
      where: { key: "cosmetique" },
      data: { sellerQuota: 5 },
    });
  });

  it("reports notFound for an unknown boutique", async () => {
    signedInAs("SUPERADMIN");
    prismaMock.storeType.updateMany.mockResolvedValue({ count: 0 } as never);

    const result = await setSellerQuota("does-not-exist", 3);

    expect(result.error).toBe("notFound");
  });
});
