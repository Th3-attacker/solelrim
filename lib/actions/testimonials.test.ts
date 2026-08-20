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
  createTestimonial,
  deleteTestimonial,
  moveTestimonial,
  setTestimonialsEnabled,
} from "@/lib/actions/testimonials";

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

const VALID_INPUT = { customerName: "Fatima M.", quote: "Livraison rapide.", rating: 5 };

describe("createTestimonial", () => {
  it("rejects malformed input", async () => {
    const result = await createTestimonial({ customerName: "", quote: "" });

    expect(result.error).toBe("invalid");
    expect(prismaMock.testimonial.create).not.toHaveBeenCalled();
  });

  it("creates an unverified testimonial when no order is linked", async () => {
    prismaMock.testimonial.aggregate.mockResolvedValue({ _max: { position: -1 } } as never);
    prismaMock.testimonial.create.mockResolvedValue({ id: "t-1" } as never);

    const result = await createTestimonial(VALID_INPUT);

    expect(result.error).toBeUndefined();
    expect(prismaMock.order.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.testimonial.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ ...VALID_INPUT, productType: "cosmetique", position: 0 }),
    });
  });

  it("links to a real delivered order of this boutique", async () => {
    prismaMock.order.findFirst.mockResolvedValue({ id: "order-1" } as never);
    prismaMock.testimonial.aggregate.mockResolvedValue({ _max: { position: 2 } } as never);
    prismaMock.testimonial.create.mockResolvedValue({ id: "t-1" } as never);

    const result = await createTestimonial({ ...VALID_INPUT, orderId: "order-1" });

    expect(result.error).toBeUndefined();
    expect(prismaMock.order.findFirst).toHaveBeenCalledWith({
      where: { id: "order-1", productType: "cosmetique", status: "DELIVERED" },
      select: { id: true },
    });
    expect(prismaMock.testimonial.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ orderId: "order-1", position: 3 }),
    });
  });

  it("rejects an orderId that doesn't belong to this boutique or isn't delivered", async () => {
    prismaMock.order.findFirst.mockResolvedValue(null);

    const result = await createTestimonial({ ...VALID_INPUT, orderId: "someone-elses-order" });

    expect(result.error).toBe("invalidOrder");
    expect(prismaMock.testimonial.create).not.toHaveBeenCalled();
  });
});

describe("deleteTestimonial", () => {
  it("reports notFound when the testimonial isn't in this boutique", async () => {
    prismaMock.testimonial.deleteMany.mockResolvedValue({ count: 0 } as never);

    const result = await deleteTestimonial("t-1");

    expect(result.error).toBe("notFound");
  });

  it("deletes a testimonial scoped to this boutique", async () => {
    prismaMock.testimonial.deleteMany.mockResolvedValue({ count: 1 } as never);

    const result = await deleteTestimonial("t-1");

    expect(result.error).toBeUndefined();
    expect(prismaMock.testimonial.deleteMany).toHaveBeenCalledWith({
      where: { id: "t-1", productType: "cosmetique" },
    });
  });
});

describe("moveTestimonial", () => {
  const ITEMS = [
    { id: "a", position: 0 },
    { id: "b", position: 1 },
  ];

  it("reports notFound for an unknown id", async () => {
    prismaMock.testimonial.findMany.mockResolvedValue(ITEMS as never);

    const result = await moveTestimonial("does-not-exist", "up");

    expect(result.error).toBe("notFound");
  });

  it("swaps positions with the next item", async () => {
    prismaMock.testimonial.findMany.mockResolvedValue(ITEMS as never);
    prismaMock.$transaction.mockResolvedValue([] as never);

    const result = await moveTestimonial("a", "down");

    expect(result?.error).toBeUndefined();
    expect(prismaMock.testimonial.update).toHaveBeenNthCalledWith(1, {
      where: { id: "a" },
      data: { position: 1 },
    });
    expect(prismaMock.testimonial.update).toHaveBeenNthCalledWith(2, {
      where: { id: "b" },
      data: { position: 0 },
    });
  });
});

describe("setTestimonialsEnabled", () => {
  it("toggles the boutique's testimonials visibility", async () => {
    prismaMock.storeType.update.mockResolvedValue({} as never);

    const result = await setTestimonialsEnabled(true);

    expect(result.error).toBeUndefined();
    expect(prismaMock.storeType.update).toHaveBeenCalledWith({
      where: { key: "cosmetique" },
      data: { testimonialsEnabled: true },
    });
  });
});
