import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/lib/generated/prisma/client";

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
  createSocialLink,
  updateSocialLink,
  deleteSocialLink,
  moveSocialLink,
} from "@/lib/actions/social-links";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const createClientMock = createClient as unknown as Mock;

function asAdmin(productType = "cosmetique") {
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

beforeEach(() => {
  mockReset(prismaMock);
  createClientMock.mockReset();
  asAdmin();
});

const VALID_INPUT = { platform: "Instagram", url: "https://instagram.com/solal" };

describe("createSocialLink", () => {
  it("rejects malformed input", async () => {
    const result = await createSocialLink({ platform: "", url: "" });

    expect(result.error).toBe("invalid");
    expect(prismaMock.socialLink.create).not.toHaveBeenCalled();
  });

  it("appends after the current highest position, scoped to this boutique", async () => {
    prismaMock.socialLink.aggregate.mockResolvedValue({ _max: { position: 2 } } as never);
    prismaMock.socialLink.create.mockResolvedValue({ id: "link-1" } as never);

    const result = await createSocialLink(VALID_INPUT);

    expect(result.error).toBeUndefined();
    expect(prismaMock.socialLink.create).toHaveBeenCalledWith({
      data: { ...VALID_INPUT, productType: "cosmetique", position: 3 },
    });
  });

  it("starts at position 0 for the first link", async () => {
    prismaMock.socialLink.aggregate.mockResolvedValue({ _max: { position: null } } as never);
    prismaMock.socialLink.create.mockResolvedValue({ id: "link-1" } as never);

    await createSocialLink(VALID_INPUT);

    expect(prismaMock.socialLink.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ position: 0 }) }),
    );
  });
});

describe("updateSocialLink", () => {
  it("rejects malformed input", async () => {
    const result = await updateSocialLink("link-1", { platform: "", url: "" });

    expect(result.error).toBe("invalid");
    expect(prismaMock.socialLink.updateMany).not.toHaveBeenCalled();
  });

  it("reports notFound when the link isn't in this boutique", async () => {
    prismaMock.socialLink.updateMany.mockResolvedValue({ count: 0 } as never);

    const result = await updateSocialLink("link-1", VALID_INPUT);

    expect(result.error).toBe("notFound");
  });

  it("updates a link scoped to this boutique", async () => {
    prismaMock.socialLink.updateMany.mockResolvedValue({ count: 1 } as never);

    const result = await updateSocialLink("link-1", VALID_INPUT);

    expect(result.error).toBeUndefined();
    expect(prismaMock.socialLink.updateMany).toHaveBeenCalledWith({
      where: { id: "link-1", productType: "cosmetique" },
      data: VALID_INPUT,
    });
  });
});

describe("deleteSocialLink", () => {
  it("reports notFound when the link isn't in this boutique", async () => {
    prismaMock.socialLink.deleteMany.mockResolvedValue({ count: 0 } as never);

    const result = await deleteSocialLink("link-1");

    expect(result.error).toBe("notFound");
  });

  it("deletes a link scoped to this boutique", async () => {
    prismaMock.socialLink.deleteMany.mockResolvedValue({ count: 1 } as never);

    const result = await deleteSocialLink("link-1");

    expect(result.error).toBeUndefined();
    expect(prismaMock.socialLink.deleteMany).toHaveBeenCalledWith({
      where: { id: "link-1", productType: "cosmetique" },
    });
  });
});

describe("moveSocialLink", () => {
  const LINKS = [
    { id: "a", position: 0 },
    { id: "b", position: 1 },
    { id: "c", position: 2 },
  ];

  it("reports notFound for an unknown id", async () => {
    prismaMock.socialLink.findMany.mockResolvedValue(LINKS as never);

    const result = await moveSocialLink("does-not-exist", "up");

    expect(result.error).toBe("notFound");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("is a no-op moving the first item up", async () => {
    prismaMock.socialLink.findMany.mockResolvedValue(LINKS as never);

    const result = await moveSocialLink("a", "up");

    expect(result.error).toBeUndefined();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("is a no-op moving the last item down", async () => {
    prismaMock.socialLink.findMany.mockResolvedValue(LINKS as never);

    const result = await moveSocialLink("c", "down");

    expect(result.error).toBeUndefined();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("swaps positions with the previous item", async () => {
    prismaMock.socialLink.findMany.mockResolvedValue(LINKS as never);
    prismaMock.$transaction.mockResolvedValue([] as never);

    const result = await moveSocialLink("b", "up");

    expect(result.error).toBeUndefined();
    expect(prismaMock.socialLink.update).toHaveBeenNthCalledWith(1, {
      where: { id: "b" },
      data: { position: 0 },
    });
    expect(prismaMock.socialLink.update).toHaveBeenNthCalledWith(2, {
      where: { id: "a" },
      data: { position: 1 },
    });
  });
});
