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
  enrollTotpFactor,
  verifyTotpEnrollment,
  unenrollTotpFactor,
  resetAdminMfa,
} from "@/lib/actions/mfa";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const createClientMock = createClient as unknown as Mock;
const createAdminClientMock = createAdminClient as unknown as Mock;

// Mirrors admin-users.test.ts: getCurrentAdmin()/requireSuperAdmin() resolve
// straight from this AdminUser row via the mocked Prisma client.
function asAdmin(
  overrides: Partial<{ role: "SUPERADMIN" | "BOUTIQUE_ADMIN"; appMetadata: Record<string, unknown> }> = {},
  auth: Record<string, unknown> = {},
) {
  createClientMock.mockResolvedValue({
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: { id: "admin-1", app_metadata: overrides.appMetadata ?? {} } } }),
      ...auth,
    },
  });
  prismaMock.adminUser.findUnique.mockResolvedValue({
    id: "admin-user-1",
    supabaseUserId: "admin-1",
    role: overrides.role ?? "BOUTIQUE_ADMIN",
    productType: "cosmetique",
    canManageAppearance: false,
    createdAt: new Date(),
  } as never);
}

beforeEach(() => {
  mockReset(prismaMock);
  createClientMock.mockReset();
  createAdminClientMock.mockReset();
});

describe("enrollTotpFactor", () => {
  it("clears stale unverified factors before enrolling a new one", async () => {
    const unenroll = vi.fn().mockResolvedValue({ error: null });
    asAdmin(
      {},
      {
        mfa: {
          listFactors: vi.fn().mockResolvedValue({
            data: {
              all: [
                { id: "stale-1", factor_type: "totp", status: "unverified" },
                { id: "verified-1", factor_type: "totp", status: "verified" },
              ],
            },
          }),
          unenroll,
          enroll: vi.fn().mockResolvedValue({
            data: { id: "new-factor", totp: { qr_code: "data:svg", secret: "SECRET" } },
            error: null,
          }),
        },
      },
    );

    const result = await enrollTotpFactor();

    expect(unenroll).toHaveBeenCalledWith({ factorId: "stale-1" });
    expect(unenroll).not.toHaveBeenCalledWith({ factorId: "verified-1" });
    expect(result).toEqual({ factorId: "new-factor", qrCode: "data:svg", secret: "SECRET" });
  });

  it("returns an error when Supabase enrollment fails", async () => {
    asAdmin(
      {},
      {
        mfa: {
          listFactors: vi.fn().mockResolvedValue({ data: { all: [] } }),
          enroll: vi.fn().mockResolvedValue({ data: null, error: { message: "nope" } }),
        },
      },
    );

    const result = await enrollTotpFactor();

    expect(result).toEqual({ error: "enrollFailed" });
  });
});

describe("verifyTotpEnrollment", () => {
  it("rejects a malformed code without calling Supabase", async () => {
    asAdmin({}, { mfa: { challengeAndVerify: vi.fn() } });

    const result = await verifyTotpEnrollment("factor-1", "abc");

    expect(result).toEqual({ error: "invalidCode" });
  });

  it("returns invalidCode when the challenge fails", async () => {
    asAdmin(
      {},
      { mfa: { challengeAndVerify: vi.fn().mockResolvedValue({ error: { message: "bad" } }) } },
    );

    const result = await verifyTotpEnrollment("factor-1", "123456");

    expect(result).toEqual({ error: "invalidCode" });
  });

  it("succeeds when the challenge passes", async () => {
    asAdmin(
      {},
      { mfa: { challengeAndVerify: vi.fn().mockResolvedValue({ error: null }) } },
    );

    const result = await verifyTotpEnrollment("factor-1", "123456");

    expect(result).toEqual({});
  });
});

describe("unenrollTotpFactor", () => {
  it("refuses to remove a SUPERADMIN-mandated factor", async () => {
    const unenroll = vi.fn();
    asAdmin({ appMetadata: { mfa_required: true } }, { mfa: { unenroll } });

    const result = await unenrollTotpFactor("factor-1");

    expect(result).toEqual({ error: "required" });
    expect(unenroll).not.toHaveBeenCalled();
  });

  it("removes the factor when 2FA isn't mandated", async () => {
    const unenroll = vi.fn().mockResolvedValue({ error: null });
    asAdmin({ appMetadata: {} }, { mfa: { unenroll } });

    const result = await unenrollTotpFactor("factor-1");

    expect(result).toEqual({});
    expect(unenroll).toHaveBeenCalledWith({ factorId: "factor-1" });
  });
});

describe("resetAdminMfa", () => {
  it("rejects a BOUTIQUE_ADMIN caller", async () => {
    asAdmin({ role: "BOUTIQUE_ADMIN" });

    await expect(resetAdminMfa("target-id")).rejects.toThrow("forbidden");
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("returns invalid for an unknown admin", async () => {
    asAdmin({ role: "SUPERADMIN" });
    prismaMock.adminUser.findUnique.mockResolvedValueOnce({
      id: "admin-user-1",
      supabaseUserId: "admin-1",
      role: "SUPERADMIN",
      productType: null,
      createdAt: new Date(),
    } as never);
    prismaMock.adminUser.findUnique.mockResolvedValueOnce(null);

    const result = await resetAdminMfa("missing-id");

    expect(result).toEqual({ error: "invalid" });
  });

  it("deletes every factor belonging to the target admin", async () => {
    asAdmin({ role: "SUPERADMIN" });
    prismaMock.adminUser.findUnique.mockResolvedValueOnce({
      id: "admin-user-1",
      supabaseUserId: "admin-1",
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

    const deleteFactor = vi.fn().mockResolvedValue({ error: null });
    createAdminClientMock.mockReturnValue({
      auth: {
        admin: {
          mfa: {
            listFactors: vi.fn().mockResolvedValue({
              data: { factors: [{ id: "f1" }, { id: "f2" }] },
            }),
            deleteFactor,
          },
        },
      },
    });

    const result = await resetAdminMfa("target-id");

    expect(result).toEqual({});
    expect(deleteFactor).toHaveBeenCalledWith({ id: "f1", userId: "target-supabase-id" });
    expect(deleteFactor).toHaveBeenCalledWith({ id: "f2", userId: "target-supabase-id" });
  });
});
