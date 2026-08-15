import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/lib/generated/prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/audit";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const createClientMock = createClient as unknown as Mock;

beforeEach(() => {
  mockReset(prismaMock);
  createClientMock.mockReset();
});

describe("logAdminAction", () => {
  it("records the action with the current user's email", async () => {
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { email: "admin@solal.mr" } } }),
      },
    });
    prismaMock.adminAuditLog.create.mockResolvedValue({} as never);

    await logAdminAction({
      adminUserId: "admin-1",
      productType: "sport",
      action: "order.cancel",
      targetLabel: "CMD-1",
    });

    expect(prismaMock.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        adminUserId: "admin-1",
        adminEmail: "admin@solal.mr",
        productType: "sport",
        action: "order.cancel",
        targetLabel: "CMD-1",
      },
    });
  });

  it("falls back to a placeholder when the session has no email", async () => {
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });
    prismaMock.adminAuditLog.create.mockResolvedValue({} as never);

    await logAdminAction({
      adminUserId: "admin-1",
      productType: "sport",
      action: "product.update",
      targetLabel: "Tshirt",
    });

    expect(prismaMock.adminAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ adminEmail: "?" }) }),
    );
  });

  it("never throws when the write itself fails", async () => {
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { email: "admin@solal.mr" } } }) },
    });
    prismaMock.adminAuditLog.create.mockRejectedValue(new Error("db down"));

    await expect(
      logAdminAction({
        adminUserId: "admin-1",
        productType: "sport",
        action: "order.cancel",
        targetLabel: "CMD-1",
      }),
    ).resolves.toBeUndefined();
  });
});
