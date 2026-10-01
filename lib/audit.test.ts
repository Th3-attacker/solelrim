import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { AdminUser, PrismaClient } from "@/lib/generated/prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getAuditActor, logAdminAction, writeAuditLog } from "@/lib/audit";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const createClientMock = createClient as unknown as Mock;

const ADMIN = {
  id: "admin-1",
  supabaseUserId: "auth-1",
  role: "BOUTIQUE_ADMIN",
  productType: "sport",
  canManageAppearance: false,
  createdAt: new Date(),
} as AdminUser;

function sessionEmail(email: string | null) {
  createClientMock.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: email ? { email } : null } }),
    },
  });
}

beforeEach(() => {
  mockReset(prismaMock);
  createClientMock.mockReset();
});

describe("getAuditActor", () => {
  it("records who acted, with their role and the session's email", async () => {
    sessionEmail("admin@solal.mr");

    expect(await getAuditActor(ADMIN)).toEqual({
      id: "admin-1",
      role: "BOUTIQUE_ADMIN",
      email: "admin@solal.mr",
    });
  });

  it("falls back to a placeholder when the session has no email", async () => {
    sessionEmail(null);

    expect((await getAuditActor(ADMIN)).email).toBe("?");
  });
});

describe("writeAuditLog", () => {
  const ACTOR = { id: "seller-1", role: "SELLER" as const, email: "amina@shop.mr" };

  it("writes through the transaction client it is given", async () => {
    const tx = mockDeep<PrismaClient>();

    await writeAuditLog(tx as never, ACTOR, {
      productType: "sport",
      action: "sale.cancel",
      targetId: "sale-1",
      targetLabel: "VNT-1",
      oldValue: { status: "COMPLETED" },
      newValue: { status: "CANCELLED" },
      reason: "Erreur de caisse",
    });

    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        adminUserId: "seller-1",
        adminEmail: "amina@shop.mr",
        adminRole: "SELLER",
        productType: "sport",
        action: "sale.cancel",
        targetId: "sale-1",
        targetLabel: "VNT-1",
        oldValue: { status: "COMPLETED" },
        newValue: { status: "CANCELLED" },
        reason: "Erreur de caisse",
      },
    });
    expect(prismaMock.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it("lets a write failure propagate, so the operation rolls back with it", async () => {
    const tx = mockDeep<PrismaClient>();
    tx.adminAuditLog.create.mockRejectedValue(new Error("db down"));

    await expect(
      writeAuditLog(tx as never, ACTOR, {
        productType: "sport",
        action: "sale.create",
        targetLabel: "VNT-1",
      }),
    ).rejects.toThrow("db down");
  });
});

describe("logAdminAction", () => {
  it("records the action with the admin's role and email", async () => {
    sessionEmail("admin@solal.mr");
    prismaMock.adminAuditLog.create.mockResolvedValue({} as never);

    await logAdminAction({
      admin: ADMIN,
      productType: "sport",
      action: "order.cancel",
      targetLabel: "CMD-1",
      targetId: "order-1",
      reason: "Client injoignable",
    });

    expect(prismaMock.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        adminUserId: "admin-1",
        adminEmail: "admin@solal.mr",
        adminRole: "BOUTIQUE_ADMIN",
        productType: "sport",
        action: "order.cancel",
        targetLabel: "CMD-1",
        targetId: "order-1",
        reason: "Client injoignable",
      },
    });
  });

  it("never fails the action it records", async () => {
    sessionEmail("admin@solal.mr");
    prismaMock.adminAuditLog.create.mockRejectedValue(new Error("db down"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      logAdminAction({
        admin: ADMIN,
        productType: "sport",
        action: "product.update",
        targetLabel: "T-shirt",
      }),
    ).resolves.toBeUndefined();
    consoleError.mockRestore();
  });
});
