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
import { createClientRecord, updateClientRecord, deleteClient } from "@/lib/actions/clients";

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

const VALID_INPUT = {
  fullName: "Fatima M.",
  phone: "23456789",
  email: "",
  address: "",
  notes: "",
};

describe("createClientRecord", () => {
  it("rejects input missing the required full name", async () => {
    const result = await createClientRecord({ ...VALID_INPUT, fullName: "" });

    expect(result.error).toBe("invalid");
    expect(prismaMock.client.create).not.toHaveBeenCalled();
  });

  it("rejects a malformed phone number", async () => {
    const result = await createClientRecord({ ...VALID_INPUT, phone: "not-a-phone" });

    expect(result.error).toBe("invalid");
    expect(prismaMock.client.create).not.toHaveBeenCalled();
  });

  it("creates the client scoped to the acting admin's boutique", async () => {
    prismaMock.client.create.mockResolvedValue({ id: "client-1" } as never);

    const result = await createClientRecord(VALID_INPUT);

    expect(result.error).toBeUndefined();
    expect(result.clientId).toBe("client-1");
    expect(prismaMock.client.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ ...VALID_INPUT, productType: "cosmetique" }),
    });
  });
});

describe("updateClientRecord", () => {
  it("rejects malformed input", async () => {
    const result = await updateClientRecord("client-1", { ...VALID_INPUT, fullName: "" });

    expect(result.error).toBe("invalid");
    expect(prismaMock.client.updateMany).not.toHaveBeenCalled();
  });

  it("reports notFound when the client isn't in this boutique", async () => {
    prismaMock.client.updateMany.mockResolvedValue({ count: 0 } as never);

    const result = await updateClientRecord("client-1", VALID_INPUT);

    expect(result.error).toBe("notFound");
  });

  it("updates a client scoped to the acting admin's boutique", async () => {
    prismaMock.client.updateMany.mockResolvedValue({ count: 1 } as never);

    const result = await updateClientRecord("client-1", VALID_INPUT);

    expect(result.error).toBeUndefined();
    expect(result.clientId).toBe("client-1");
    expect(prismaMock.client.updateMany).toHaveBeenCalledWith({
      where: { id: "client-1", productType: "cosmetique" },
      data: expect.objectContaining({ fullName: "Fatima M." }),
    });
  });
});

describe("deleteClient", () => {
  it("reports notFound when the client isn't in this boutique", async () => {
    prismaMock.client.findFirst.mockResolvedValue(null);

    const result = await deleteClient("client-1");

    expect(result.error).toBe("notFound");
    expect(prismaMock.client.delete).not.toHaveBeenCalled();
  });

  it("refuses to delete a client that has recorded sales", async () => {
    prismaMock.client.findFirst.mockResolvedValue({ id: "client-1" } as never);
    prismaMock.sale.count.mockResolvedValue(2);

    const result = await deleteClient("client-1");

    expect(result.error).toBe("hasSales");
    expect(prismaMock.client.delete).not.toHaveBeenCalled();
  });

  it("deletes a client with no sales history", async () => {
    prismaMock.client.findFirst.mockResolvedValue({ id: "client-1" } as never);
    prismaMock.sale.count.mockResolvedValue(0);
    prismaMock.client.delete.mockResolvedValue({} as never);

    const result = await deleteClient("client-1");

    expect(result.error).toBeUndefined();
    expect(prismaMock.client.delete).toHaveBeenCalledWith({ where: { id: "client-1" } });
  });
});
