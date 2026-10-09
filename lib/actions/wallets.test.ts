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
  createWalletAccount,
  updateWalletAccount,
  deleteWalletAccount,
  moveWalletAccount,
} from "@/lib/actions/wallets";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const createClientMock = createClient as unknown as Mock;
const createAdminClientMock = createAdminClient as unknown as Mock;

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

function walletFormData(fields: {
  provider?: string;
  number?: string;
}) {
  const fd = new FormData();
  if (fields.provider !== undefined) fd.set("provider", fields.provider);
  if (fields.number !== undefined) fd.set("number", fields.number);
  return fd;
}

beforeEach(() => {
  mockReset(prismaMock);
  createClientMock.mockReset();
  createAdminClientMock.mockReset();
  asAdmin();
});

describe("createWalletAccount", () => {
  it("rejects malformed input", async () => {
    const result = await createWalletAccount(walletFormData({ provider: "", number: "" }));

    expect(result.error).toBe("invalid");
    expect(prismaMock.walletAccount.create).not.toHaveBeenCalled();
  });

  it("creates a wallet", async () => {
    prismaMock.walletAccount.aggregate.mockResolvedValue({ _max: { position: -1 } } as never);
    prismaMock.walletAccount.create.mockResolvedValue({ id: "w-1" } as never);

    const result = await createWalletAccount(
      walletFormData({ provider: "Bankily", number: "12345678" }),
    );

    expect(result.error).toBeUndefined();
    expect(createAdminClientMock).not.toHaveBeenCalled();
    expect(prismaMock.walletAccount.create).toHaveBeenCalledWith({
      data: {
        provider: "Bankily",
        number: "12345678",
        productType: "cosmetique",
        position: 0,
      },
    });
  });
});

describe("updateWalletAccount", () => {
  it("rejects malformed input", async () => {
    const result = await updateWalletAccount("w-1", walletFormData({ provider: "", number: "" }));

    expect(result.error).toBe("invalid");
    expect(prismaMock.walletAccount.update).not.toHaveBeenCalled();
  });

  it("reports notFound when the wallet isn't in this boutique", async () => {
    prismaMock.walletAccount.findFirst.mockResolvedValue(null);

    const result = await updateWalletAccount(
      "w-1",
      walletFormData({ provider: "Bankily", number: "12345678" }),
    );

    expect(result.error).toBe("notFound");
  });

  it("drops the old uploaded logo once the provider is a known one", async () => {
    prismaMock.walletAccount.findFirst.mockResolvedValue({
      id: "w-1",
      logoStoragePath: "branding/wallet-old.png",
    } as never);
    const remove = vi.fn().mockResolvedValue({});
    createAdminClientMock.mockReturnValue({ storage: { from: () => ({ remove } as never) } });
    prismaMock.walletAccount.update.mockResolvedValue({} as never);

    const result = await updateWalletAccount(
      "w-1",
      walletFormData({ provider: "Bankily", number: "12345678" }),
    );

    expect(result.error).toBeUndefined();
    expect(remove).toHaveBeenCalledWith(["branding/wallet-old.png"]);
    expect(prismaMock.walletAccount.update).toHaveBeenCalledWith({
      where: { id: "w-1" },
      data: expect.objectContaining({ logoStoragePath: null }),
    });
  });

  it("keeps the uploaded logo of a provider we don't know", async () => {
    prismaMock.walletAccount.findFirst.mockResolvedValue({
      id: "w-1",
      logoStoragePath: "branding/wallet-old.png",
    } as never);
    prismaMock.walletAccount.update.mockResolvedValue({} as never);

    const result = await updateWalletAccount(
      "w-1",
      walletFormData({ provider: "Ma banque", number: "12345678" }),
    );

    expect(result.error).toBeUndefined();
    expect(createAdminClientMock).not.toHaveBeenCalled();
    expect(prismaMock.walletAccount.update).toHaveBeenCalledWith({
      where: { id: "w-1" },
      data: expect.objectContaining({ logoStoragePath: "branding/wallet-old.png" }),
    });
  });
});

describe("deleteWalletAccount", () => {
  it("reports notFound when the wallet isn't in this boutique", async () => {
    prismaMock.walletAccount.findFirst.mockResolvedValue(null);

    const result = await deleteWalletAccount("w-1");

    expect(result.error).toBe("notFound");
    expect(prismaMock.walletAccount.deleteMany).not.toHaveBeenCalled();
  });

  it("removes the stored logo and deletes the row", async () => {
    prismaMock.walletAccount.findFirst.mockResolvedValue({
      id: "w-1",
      logoStoragePath: "branding/wallet-old.png",
    } as never);
    const remove = vi.fn().mockResolvedValue({});
    createAdminClientMock.mockReturnValue({ storage: { from: () => ({ remove } as never) } });
    prismaMock.walletAccount.deleteMany.mockResolvedValue({ count: 1 } as never);

    const result = await deleteWalletAccount("w-1");

    expect(result.error).toBeUndefined();
    expect(remove).toHaveBeenCalledWith(["branding/wallet-old.png"]);
    expect(prismaMock.walletAccount.deleteMany).toHaveBeenCalledWith({
      where: { id: "w-1", productType: "cosmetique" },
    });
  });

  it("skips storage removal when there was no logo", async () => {
    prismaMock.walletAccount.findFirst.mockResolvedValue({
      id: "w-1",
      logoStoragePath: null,
    } as never);
    prismaMock.walletAccount.deleteMany.mockResolvedValue({ count: 1 } as never);

    const result = await deleteWalletAccount("w-1");

    expect(result.error).toBeUndefined();
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });
});

describe("moveWalletAccount", () => {
  const WALLETS = [
    { id: "a", position: 0 },
    { id: "b", position: 1 },
  ];

  it("reports notFound for an unknown id", async () => {
    prismaMock.walletAccount.findMany.mockResolvedValue(WALLETS as never);

    const result = await moveWalletAccount("does-not-exist", "up");

    expect(result.error).toBe("notFound");
  });

  it("swaps positions with the next item", async () => {
    prismaMock.walletAccount.findMany.mockResolvedValue(WALLETS as never);
    prismaMock.$transaction.mockResolvedValue([] as never);

    const result = await moveWalletAccount("a", "down");

    expect(result?.error).toBeUndefined();
    expect(prismaMock.walletAccount.update).toHaveBeenNthCalledWith(1, {
      where: { id: "a" },
      data: { position: 1 },
    });
    expect(prismaMock.walletAccount.update).toHaveBeenNthCalledWith(2, {
      where: { id: "b" },
      data: { position: 0 },
    });
  });
});
