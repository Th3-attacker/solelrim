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
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import {
  enrollLoyaltyCard,
  lookupLoyaltyCard,
  updateLoyaltySettings,
} from "@/lib/actions/loyalty";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const createClientMock = createClient as unknown as Mock;

function signedInAs(role: "BOUTIQUE_ADMIN" | "SELLER") {
  createClientMock.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "auth-1" } } }) },
  });
  prismaMock.adminUser.findUnique.mockResolvedValue({
    id: "admin-1",
    supabaseUserId: "auth-1",
    role,
    productType: "cosmetique",
    canManageAppearance: false,
    createdAt: new Date(),
  } as never);
}

function boutique(loyaltyEnabled = true) {
  prismaMock.storeType.findUnique.mockResolvedValue({
    licenseType: "MONTHLY",
    licenseStatus: "ACTIVE",
    licenseExpiresAt: null,
    loyaltyEnabled,
  } as never);
}

const CARD_ROW = { id: "client-1", fullName: "Aïcha", phone: "22123456", loyaltyPoints: 40 };
const CARD = { clientId: "client-1", name: "Aïcha", phone: "22123456", points: 40 };

beforeEach(() => {
  mockReset(prismaMock);
  createClientMock.mockReset();
});

describe("lookupLoyaltyCard", () => {
  it("finds an enrolled card by number, whatever the formatting, inside the caller's boutique", async () => {
    signedInAs("SELLER");
    boutique();
    prismaMock.client.findFirst.mockResolvedValue(CARD_ROW as never);

    const result = await lookupLoyaltyCard("+222 22 12 34 56");

    expect(result).toEqual({ card: CARD });
    expect(prismaMock.client.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productType: "cosmetique", phone: "22123456", loyaltyEnrolledAt: { not: null } },
      }),
    );
  });

  it("returns a null card when the number has none, so the seller can offer to enroll", async () => {
    signedInAs("SELLER");
    boutique();
    prismaMock.client.findFirst.mockResolvedValue(null);

    expect(await lookupLoyaltyCard("22123456")).toEqual({ card: null });
  });

  it("rejects an invalid number before querying clients", async () => {
    signedInAs("SELLER");
    boutique();

    expect(await lookupLoyaltyCard("123")).toEqual({ error: "invalidPhone" });
    expect(prismaMock.client.findFirst).not.toHaveBeenCalled();
  });

  it("reports disabled when the boutique switched loyalty off", async () => {
    signedInAs("SELLER");
    boutique(false);

    expect(await lookupLoyaltyCard("22123456")).toEqual({ error: "disabled" });
  });

  it("reports unauthorized for a caller who isn't signed in", async () => {
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });

    expect(await lookupLoyaltyCard("22123456")).toEqual({ error: "unauthorized" });
  });
});

describe("enrollLoyaltyCard", () => {
  it("returns the existing card instead of enrolling twice", async () => {
    signedInAs("SELLER");
    boutique();
    prismaMock.client.findFirst.mockResolvedValueOnce(CARD_ROW as never);

    const result = await enrollLoyaltyCard({ phone: "22123456", name: "" });

    expect(result).toEqual({ card: CARD });
    expect(prismaMock.client.create).not.toHaveBeenCalled();
    expect(prismaMock.client.update).not.toHaveBeenCalled();
  });

  it("enrolls a client the admin already created with this number rather than duplicating it", async () => {
    signedInAs("SELLER");
    boutique();
    prismaMock.client.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "client-1" } as never);
    prismaMock.client.update.mockResolvedValue({ ...CARD_ROW, loyaltyPoints: 0 } as never);

    const result = await enrollLoyaltyCard({ phone: "22123456", name: "" });

    expect(result.card?.clientId).toBe("client-1");
    expect(prismaMock.client.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "client-1" },
        data: { loyaltyEnrolledAt: expect.any(Date) },
      }),
    );
    expect(prismaMock.client.create).not.toHaveBeenCalled();
  });

  it("creates a new client named after the number when no name is given", async () => {
    signedInAs("SELLER");
    boutique();
    prismaMock.client.findFirst.mockResolvedValue(null);
    prismaMock.client.create.mockResolvedValue({
      ...CARD_ROW,
      fullName: "22123456",
      loyaltyPoints: 0,
    } as never);

    await enrollLoyaltyCard({ phone: "22 12 34 56", name: "  " });

    expect(prismaMock.client.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          fullName: "22123456",
          phone: "22123456",
          productType: "cosmetique",
          loyaltyEnrolledAt: expect.any(Date),
        },
      }),
    );
  });

  it("hands the winner's card back when another counter enrolled the same number first", async () => {
    signedInAs("SELLER");
    boutique();
    prismaMock.client.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(CARD_ROW as never);
    prismaMock.client.create.mockRejectedValue(
      new PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    expect(await enrollLoyaltyCard({ phone: "22123456", name: "Aïcha" })).toEqual({ card: CARD });
  });

  it("reports disabled when the boutique switched loyalty off", async () => {
    signedInAs("SELLER");
    boutique(false);

    expect(await enrollLoyaltyCard({ phone: "22123456", name: "" })).toEqual({ error: "disabled" });
    expect(prismaMock.client.create).not.toHaveBeenCalled();
  });
});

describe("updateLoyaltySettings", () => {
  const RULE = { enabled: true, spendPerPoint: 100, rewardPoints: 50, rewardValue: 500 };

  it("saves the boutique admin's rule on their own boutique", async () => {
    signedInAs("BOUTIQUE_ADMIN");
    boutique();
    prismaMock.storeType.update.mockResolvedValue({} as never);

    expect(await updateLoyaltySettings(RULE)).toEqual({});
    expect(prismaMock.storeType.update).toHaveBeenCalledWith({
      where: { key: "cosmetique" },
      data: {
        loyaltyEnabled: true,
        loyaltySpendPerPoint: 100,
        loyaltyRewardPoints: 50,
        loyaltyRewardValue: 500,
      },
    });
  });

  it("rejects a zero or fractional rule", async () => {
    signedInAs("BOUTIQUE_ADMIN");
    boutique();

    expect(await updateLoyaltySettings({ ...RULE, spendPerPoint: 0 })).toEqual({ error: "invalid" });
    expect(await updateLoyaltySettings({ ...RULE, rewardPoints: 1.5 })).toEqual({ error: "invalid" });
    expect(prismaMock.storeType.update).not.toHaveBeenCalled();
  });

  it("never lets a seller change the rule", async () => {
    signedInAs("SELLER");
    boutique();

    await expect(updateLoyaltySettings(RULE)).rejects.toThrow();
    expect(prismaMock.storeType.update).not.toHaveBeenCalled();
  });
});
