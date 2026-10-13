import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/lib/generated/prisma/client";

vi.mock("@/lib/prisma", () => ({ prisma: mockDeep<PrismaClient>() }));

import { prisma } from "@/lib/prisma";
import { getStoreSettings } from "@/lib/queries/settings";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

beforeEach(() => mockReset(prismaMock));

describe("getStoreSettings", () => {
  it("only reads once the singleton exists", async () => {
    prismaMock.storeSettings.findUnique.mockResolvedValue({ id: "singleton" } as never);

    expect(await getStoreSettings()).toEqual({ id: "singleton" });
    expect(prismaMock.storeSettings.upsert).not.toHaveBeenCalled();
  });

  it("creates it the first time", async () => {
    prismaMock.storeSettings.findUnique.mockResolvedValue(null);
    prismaMock.storeSettings.upsert.mockResolvedValue({ id: "singleton" } as never);

    expect(await getStoreSettings()).toEqual({ id: "singleton" });
    expect(prismaMock.storeSettings.upsert).toHaveBeenCalledWith({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    });
  });
});
