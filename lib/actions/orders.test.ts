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
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));
vi.mock("@/lib/queries/settings", () => ({
  getStoreTypes: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getStoreTypes } from "@/lib/queries/settings";
import {
  submitOrder,
  confirmOrder,
  rejectOrder,
  shipOrder,
  deliverOrder,
  cancelOrder,
} from "@/lib/actions/orders";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const createClientMock = createClient as unknown as Mock;
const createAdminClientMock = createAdminClient as unknown as Mock;
const headersMock = headers as unknown as Mock;
const getStoreTypesMock = getStoreTypes as unknown as Mock;

const STORE_TYPES = [
  { key: "sport", label: "Sport", themeId: "default", createdAt: new Date() },
  { key: "cosmetique", label: "Cosmétique", themeId: "rose", createdAt: new Date() },
];

// Prisma Decimal fields only need `.toNumber()` for this module's purposes.
function decimal(value: number) {
  return { toNumber: () => value };
}

function collisionError() {
  return new PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

// Modeled as a BOUTIQUE_ADMIN rather than SUPERADMIN: requireAdminScope()
// short-circuits straight to admin.productType for this role without ever
// touching getAdminScope()'s cookie/StoreType lookups, so this is the
// minimal fixture that exercises every action's real code path without
// needing next/headers' cookies() (unmocked here) or prismaMock.storeType.
function asAdmin() {
  createClientMock.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-1" } } }) },
  });
  prismaMock.adminUser.findUnique.mockResolvedValue({
    id: "admin-user-1",
    supabaseUserId: "admin-1",
    role: "BOUTIQUE_ADMIN",
    productType: "cosmetique",
    createdAt: new Date(),
  } as never);
}

function asAnonymous() {
  createClientMock.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  });
}

beforeEach(() => {
  mockReset(prismaMock);
  createClientMock.mockReset();
  createAdminClientMock.mockReset();
  (revalidatePath as unknown as Mock).mockReset();
  headersMock.mockReset();
  // Every action but submitOrder starts with requireAdmin(); default to an
  // authorized session so each describe block only overrides when the test
  // is specifically about authorization.
  asAdmin();
  // Transaction callbacks in this module always run in-process against the
  // same mocked client, so `tx` and `prisma` can share one mock.
  prismaMock.$transaction.mockImplementation((cb) =>
    (cb as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock),
  );
  // submitOrder's rate limit check: under the limit and no forwarded IP by
  // default, so existing tests don't need to know about it.
  headersMock.mockResolvedValue({ get: () => null });
  prismaMock.rateLimitHit.count.mockResolvedValue(0);
  // The boutique the checkout form claims to be submitted from — validated
  // against this registry, then must line up with baseVariant.product's
  // productType (below) for the happy path.
  getStoreTypesMock.mockReset();
  getStoreTypesMock.mockResolvedValue(STORE_TYPES);
});

// Only the first bytes matter for signature detection — this doesn't need
// to be a fully decodable PNG.
const PNG_MAGIC_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function buildOrderForm(overrides: Partial<Record<string, string>> = {}) {
  const form = new FormData();
  form.set("customerName", overrides.customerName ?? "Aicha Mint Salem");
  form.set("customerPhone", overrides.customerPhone ?? "22345678");
  form.set("customerCity", overrides.customerCity ?? "Nouakchott");
  form.set("locale", overrides.locale ?? "fr");
  form.set("productType", overrides.productType ?? "cosmetique");
  form.set(
    "items",
    overrides.items ?? JSON.stringify([{ variantId: "variant-1", quantity: 2 }]),
  );
  if (overrides.promoCode) {
    form.set("promoCode", overrides.promoCode);
  }
  if (overrides.screenshot === "none") {
    // omitted
  } else if (overrides.screenshot === "invalid-content") {
    form.set(
      "screenshot",
      new File(["not-actually-an-image"], "proof.png", { type: "image/png" }),
    );
  } else if (overrides.screenshot === "too-large") {
    form.set(
      "screenshot",
      new File([new Uint8Array(1_600_000)], "proof.png", { type: "image/png" }),
    );
  } else {
    form.set(
      "screenshot",
      new File([PNG_MAGIC_BYTES], "proof.png", { type: "image/png" }),
    );
  }
  return form;
}

const baseVariant = {
  id: "variant-1",
  stock: 10,
  price: null,
  product: { basePrice: decimal(1500), productType: "cosmetique" },
};

describe("submitOrder", () => {
  it("rejects an invalid customer payload", async () => {
    const form = buildOrderForm({ customerPhone: "not-a-phone" });
    const result = await submitOrder(form);
    expect(result).toEqual({ error: "invalid" });
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });

  it("rejects malformed items JSON", async () => {
    const form = buildOrderForm({ items: "{not-json" });
    const result = await submitOrder(form);
    expect(result).toEqual({ error: "invalid" });
  });

  it("rejects items referencing an unknown variant", async () => {
    prismaMock.productVariant.findMany.mockResolvedValue([]);
    const form = buildOrderForm();
    const result = await submitOrder(form);
    expect(result).toEqual({ error: "invalid" });
  });

  it("rejects when a variant belongs to a different boutique than the form claims", async () => {
    prismaMock.productVariant.findMany.mockResolvedValue([baseVariant] as never);
    const result = await submitOrder(buildOrderForm({ productType: "sport" }));
    expect(result).toEqual({ error: "invalid" });
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });

  it("rejects a productType that isn't a real boutique", async () => {
    prismaMock.productVariant.findMany.mockResolvedValue([baseVariant] as never);
    const result = await submitOrder(buildOrderForm({ productType: "does-not-exist" }));
    expect(result).toEqual({ error: "invalid" });
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });

  it("rejects when a variant has insufficient stock", async () => {
    prismaMock.productVariant.findMany.mockResolvedValue([
      { ...baseVariant, stock: 1 },
    ] as never);
    const form = buildOrderForm({
      items: JSON.stringify([{ variantId: "variant-1", quantity: 2 }]),
    });
    const result = await submitOrder(form);
    expect(result).toEqual({ error: "insufficientStock" });
  });

  it("rejects a missing payment screenshot", async () => {
    prismaMock.productVariant.findMany.mockResolvedValue([baseVariant] as never);
    const form = buildOrderForm({ screenshot: "none" });
    const result = await submitOrder(form);
    expect(result).toEqual({ error: "invalidFile" });
  });

  it("rejects a screenshot whose bytes don't match a real image format, regardless of its claimed type", async () => {
    prismaMock.productVariant.findMany.mockResolvedValue([baseVariant] as never);
    const form = buildOrderForm({ screenshot: "invalid-content" });
    const result = await submitOrder(form);
    expect(result).toEqual({ error: "invalidFile" });
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("rejects a screenshot over the size limit", async () => {
    prismaMock.productVariant.findMany.mockResolvedValue([baseVariant] as never);
    const form = buildOrderForm({ screenshot: "too-large" });
    const result = await submitOrder(form);
    expect(result).toEqual({ error: "invalidFile" });
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("uploads under the detected content type and extension, not the client-claimed one", async () => {
    prismaMock.productVariant.findMany.mockResolvedValue([baseVariant] as never);
    const upload = vi.fn().mockResolvedValue({ error: null });
    createAdminClientMock.mockReturnValue({ storage: { from: () => ({ upload }) } });
    prismaMock.order.create.mockResolvedValue({
      id: "order-1",
      reference: "CMD-20260729-1234",
    } as never);

    // Client claims image/png via both the filename and the File.type, but
    // the bytes are a JPEG signature — the stored file must follow the
    // bytes, not the label.
    const form = buildOrderForm();
    form.set(
      "screenshot",
      new File([new Uint8Array([0xff, 0xd8, 0xff])], "proof.png", { type: "image/png" }),
    );

    await submitOrder(form);

    expect(upload).toHaveBeenCalledTimes(1);
    const [path, , options] = upload.mock.calls[0];
    expect(path).toMatch(/\.jpg$/);
    expect(options).toEqual({ contentType: "image/jpeg" });
  });

  it("surfaces a storage upload failure", async () => {
    prismaMock.productVariant.findMany.mockResolvedValue([baseVariant] as never);
    createAdminClientMock.mockReturnValue({
      storage: {
        from: () => ({
          upload: vi.fn().mockResolvedValue({ error: new Error("boom") }),
        }),
      },
    });
    const result = await submitOrder(buildOrderForm());
    expect(result).toEqual({ error: "uploadFailed" });
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });

  it("creates the order, prices it from the variant, and revalidates the admin list", async () => {
    prismaMock.productVariant.findMany.mockResolvedValue([baseVariant] as never);
    createAdminClientMock.mockReturnValue({
      storage: { from: () => ({ upload: vi.fn().mockResolvedValue({ error: null }) }) },
    });
    prismaMock.order.create.mockResolvedValue({
      id: "order-1",
      reference: "CMD-20260729-1234",
    } as never);

    const result = await submitOrder(buildOrderForm());

    expect(result).toEqual({ reference: "CMD-20260729-1234", orderId: "order-1" });
    expect(prismaMock.order.create).toHaveBeenCalledTimes(1);
    const createArgs = prismaMock.order.create.mock.calls[0][0];
    expect(createArgs.data.subtotal).toBe(3000); // basePrice 1500 * qty 2
    expect(createArgs.data.total).toBe(3000);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/orders");
  });

  it("applies a valid promo code, stores the discount, and increments usedCount", async () => {
    prismaMock.productVariant.findMany.mockResolvedValue([baseVariant] as never);
    createAdminClientMock.mockReturnValue({
      storage: { from: () => ({ upload: vi.fn().mockResolvedValue({ error: null }) }) },
    });
    prismaMock.promoCode.findUnique.mockResolvedValue({
      id: "promo-1",
      isActive: true,
      productType: "cosmetique",
      discountType: "PERCENT",
      discountValue: decimal(10),
      expiresAt: null,
      maxUses: null,
      usedCount: 0,
      clientId: null,
      client: null,
    } as never);
    prismaMock.promoCode.update.mockResolvedValue({} as never);
    prismaMock.order.create.mockResolvedValue({
      id: "order-1",
      reference: "CMD-20260729-1234",
    } as never);

    const result = await submitOrder(buildOrderForm({ promoCode: "welcome10" }));

    expect(result).toEqual({ reference: "CMD-20260729-1234", orderId: "order-1" });
    expect(prismaMock.promoCode.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { code: "WELCOME10" } }),
    );
    expect(prismaMock.promoCode.update).toHaveBeenCalledWith({
      where: { id: "promo-1" },
      data: { usedCount: { increment: 1 } },
    });
    const createArgs = prismaMock.order.create.mock.calls[0][0];
    expect(createArgs.data.subtotal).toBe(3000);
    expect(createArgs.data.discount).toBe(300); // 10% of 3000
    expect(createArgs.data.total).toBe(2700);
    expect(createArgs.data.promoCodeId).toBe("promo-1");
  });

  it("rejects an expired promo code and does not create the order", async () => {
    prismaMock.productVariant.findMany.mockResolvedValue([baseVariant] as never);
    createAdminClientMock.mockReturnValue({
      storage: { from: () => ({ upload: vi.fn().mockResolvedValue({ error: null }) }) },
    });
    prismaMock.promoCode.findUnique.mockResolvedValue({
      id: "promo-1",
      isActive: true,
      productType: "cosmetique",
      discountType: "PERCENT",
      discountValue: decimal(10),
      expiresAt: new Date("2020-01-01"),
      maxUses: null,
      usedCount: 0,
      clientId: null,
      client: null,
    } as never);

    const result = await submitOrder(buildOrderForm({ promoCode: "EXPIRED" }));

    expect(result).toEqual({ error: "expired" });
    expect(prismaMock.order.create).not.toHaveBeenCalled();
    expect(prismaMock.promoCode.update).not.toHaveBeenCalled();
  });

  it("rejects a personal promo code when the phone doesn't match", async () => {
    prismaMock.productVariant.findMany.mockResolvedValue([baseVariant] as never);
    createAdminClientMock.mockReturnValue({
      storage: { from: () => ({ upload: vi.fn().mockResolvedValue({ error: null }) }) },
    });
    prismaMock.promoCode.findUnique.mockResolvedValue({
      id: "promo-1",
      isActive: true,
      productType: "cosmetique",
      discountType: "FIXED",
      discountValue: decimal(500),
      expiresAt: null,
      maxUses: null,
      usedCount: 0,
      clientId: "client-1",
      client: { phone: "20000000" },
    } as never);

    const result = await submitOrder(
      buildOrderForm({ promoCode: "VIP-AICHA", customerPhone: "22345678" }),
    );

    expect(result).toEqual({ error: "notYours" });
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });

  it("prefers the variant override price over the product base price", async () => {
    prismaMock.productVariant.findMany.mockResolvedValue([
      { ...baseVariant, price: decimal(1800) },
    ] as never);
    createAdminClientMock.mockReturnValue({
      storage: { from: () => ({ upload: vi.fn().mockResolvedValue({ error: null }) }) },
    });
    prismaMock.order.create.mockResolvedValue({
      id: "order-1",
      reference: "CMD-20260729-1234",
    } as never);

    await submitOrder(buildOrderForm());

    const createArgs = prismaMock.order.create.mock.calls[0][0];
    expect(createArgs.data.subtotal).toBe(3600); // override price 1800 * qty 2
  });

  it("rejects with rateLimited and does no work when the caller's IP is over the limit", async () => {
    headersMock.mockResolvedValue({
      get: (name: string) => (name === "x-forwarded-for" ? "203.0.113.9, 10.0.0.1" : null),
    });
    prismaMock.rateLimitHit.count.mockResolvedValue(5);

    const result = await submitOrder(buildOrderForm());

    expect(result).toEqual({ error: "rateLimited" });
    expect(prismaMock.rateLimitHit.create).not.toHaveBeenCalled();
    expect(prismaMock.productVariant.findMany).not.toHaveBeenCalled();
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });

  it("counts a rate-limit hit against the first IP in x-forwarded-for", async () => {
    headersMock.mockResolvedValue({
      get: (name: string) => (name === "x-forwarded-for" ? "203.0.113.9, 10.0.0.1" : null),
    });
    prismaMock.productVariant.findMany.mockResolvedValue([baseVariant] as never);
    createAdminClientMock.mockReturnValue({
      storage: { from: () => ({ upload: vi.fn().mockResolvedValue({ error: null }) }) },
    });
    prismaMock.order.create.mockResolvedValue({
      id: "order-1",
      reference: "CMD-20260729-1234",
    } as never);

    await submitOrder(buildOrderForm());

    expect(prismaMock.rateLimitHit.create).toHaveBeenCalledWith({
      data: { key: "order:203.0.113.9" },
    });
  });

  it("retries the reference once on a collision, then succeeds", async () => {
    prismaMock.productVariant.findMany.mockResolvedValue([baseVariant] as never);
    createAdminClientMock.mockReturnValue({
      storage: { from: () => ({ upload: vi.fn().mockResolvedValue({ error: null }) }) },
    });
    prismaMock.order.create
      .mockRejectedValueOnce(collisionError())
      .mockResolvedValueOnce({ id: "order-2", reference: "CMD-20260729-5678" } as never);

    const result = await submitOrder(buildOrderForm());

    expect(result).toEqual({ reference: "CMD-20260729-5678", orderId: "order-2" });
    expect(prismaMock.order.create).toHaveBeenCalledTimes(2);
  });

  it("gives up after 3 reference collisions", async () => {
    prismaMock.productVariant.findMany.mockResolvedValue([baseVariant] as never);
    createAdminClientMock.mockReturnValue({
      storage: { from: () => ({ upload: vi.fn().mockResolvedValue({ error: null }) }) },
    });
    prismaMock.order.create.mockRejectedValue(collisionError());

    const result = await submitOrder(buildOrderForm());

    expect(result).toEqual({ error: "referenceCollision" });
    expect(prismaMock.order.create).toHaveBeenCalledTimes(3);
  });

  it("propagates a non-collision database error instead of retrying", async () => {
    prismaMock.productVariant.findMany.mockResolvedValue([baseVariant] as never);
    createAdminClientMock.mockReturnValue({
      storage: { from: () => ({ upload: vi.fn().mockResolvedValue({ error: null }) }) },
    });
    prismaMock.order.create.mockRejectedValue(new Error("connection lost"));

    await expect(submitOrder(buildOrderForm())).rejects.toThrow("connection lost");
    expect(prismaMock.order.create).toHaveBeenCalledTimes(1);
  });
});

describe("confirmOrder", () => {
  it("rejects an unauthenticated caller before touching the database", async () => {
    asAnonymous();
    await expect(confirmOrder("order-1")).rejects.toThrow("unauthorized");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("returns notFound when the order does not exist", async () => {
    prismaMock.order.findFirst.mockResolvedValue(null);
    const result = await confirmOrder("missing");
    expect(result).toEqual({ error: "notFound" });
  });

  it("returns notPending when the order already moved on", async () => {
    prismaMock.order.findFirst.mockResolvedValue({
      id: "order-1",
      status: "CONFIRMED",
      items: [],
    } as never);
    const result = await confirmOrder("order-1");
    expect(result).toEqual({ error: "notPending" });
  });

  it("returns insufficientStock when a variant no longer has enough stock", async () => {
    prismaMock.order.findFirst.mockResolvedValue({
      id: "order-1",
      status: "PENDING",
      items: [{ variantId: "variant-1", quantity: 5 }],
    } as never);
    prismaMock.productVariant.findUnique.mockResolvedValue({
      id: "variant-1",
      stock: 2,
    } as never);
    const result = await confirmOrder("order-1");
    expect(result).toEqual({ error: "insufficientStock" });
    expect(prismaMock.productVariant.update).not.toHaveBeenCalled();
  });

  it("decrements stock per line, marks the order CONFIRMED, and revalidates", async () => {
    prismaMock.order.findFirst.mockResolvedValue({
      id: "order-1",
      status: "PENDING",
      items: [
        { variantId: "variant-1", quantity: 3 },
        { variantId: "variant-2", quantity: 1 },
      ],
    } as never);
    prismaMock.productVariant.findUnique
      .mockResolvedValueOnce({ id: "variant-1", stock: 10 } as never)
      .mockResolvedValueOnce({ id: "variant-2", stock: 10 } as never);

    const result = await confirmOrder("order-1");

    expect(result).toEqual({});
    expect(prismaMock.productVariant.update).toHaveBeenCalledWith({
      where: { id: "variant-1" },
      data: { stock: { decrement: 3 } },
    });
    expect(prismaMock.productVariant.update).toHaveBeenCalledWith({
      where: { id: "variant-2" },
      data: { stock: { decrement: 1 } },
    });
    expect(prismaMock.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order-1" },
        data: expect.objectContaining({ status: "CONFIRMED" }),
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/admin/orders");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/orders/order-1");
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });
});

describe("rejectOrder", () => {
  it("rejects an empty reason", async () => {
    const result = await rejectOrder("order-1", "");
    expect(result).toEqual({ error: "invalid" });
    expect(prismaMock.order.updateMany).not.toHaveBeenCalled();
  });

  it("returns notPending when no PENDING order matched the update", async () => {
    prismaMock.order.updateMany.mockResolvedValue({ count: 0 });
    const result = await rejectOrder("order-1", "Rupture de stock");
    expect(result).toEqual({ error: "notPending" });
  });

  it("rejects a pending order with the given reason", async () => {
    prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
    const result = await rejectOrder("order-1", "Rupture de stock");
    expect(result).toEqual({});
    expect(prismaMock.order.updateMany).toHaveBeenCalledWith({
      where: { id: "order-1", status: "PENDING", productType: "cosmetique" },
      data: expect.objectContaining({
        status: "REJECTED",
        rejectReason: "Rupture de stock",
      }),
    });
  });
});

describe("shipOrder", () => {
  it("returns invalidTransition when the order isn't CONFIRMED", async () => {
    prismaMock.order.updateMany.mockResolvedValue({ count: 0 });
    const result = await shipOrder("order-1");
    expect(result).toEqual({ error: "invalidTransition" });
  });

  it("moves a confirmed order to SHIPPING", async () => {
    prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
    const result = await shipOrder("order-1");
    expect(result).toEqual({});
    expect(prismaMock.order.updateMany).toHaveBeenCalledWith({
      where: { id: "order-1", status: "CONFIRMED", productType: "cosmetique" },
      data: expect.objectContaining({ status: "SHIPPING" }),
    });
  });
});

describe("deliverOrder", () => {
  function primeSuccessfulDelivery() {
    prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.$queryRaw.mockResolvedValue([
      { productId: "product-1" },
      { productId: "product-2" },
    ] as never);
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({
      id: "order-1",
      reference: "CMD-20260729-1234",
      subtotal: decimal(3000),
      total: decimal(3000),
      productType: "cosmetique",
      items: [{ variantId: "variant-1", quantity: 2, unitPrice: 1500, lineTotal: 3000 }],
    } as never);
  }

  it("returns invalidTransition when the order isn't SHIPPING", async () => {
    prismaMock.order.updateMany.mockResolvedValue({ count: 0 });
    const result = await deliverOrder("order-1");
    expect(result).toEqual({ error: "invalidTransition" });
    expect(prismaMock.product.updateMany).not.toHaveBeenCalled();
  });

  it("marks DELIVERED, recomputes best-sellers, and books the matching sale", async () => {
    primeSuccessfulDelivery();
    prismaMock.sale.create.mockResolvedValue({ id: "sale-1" } as never);

    const result = await deliverOrder("order-1");

    expect(result).toEqual({});
    expect(prismaMock.product.updateMany).toHaveBeenCalledWith({
      where: { productType: "cosmetique" },
      data: { isFeatured: false },
    });
    expect(prismaMock.product.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["product-1", "product-2"] } },
      data: { isFeatured: true },
    });
    const saleArgs = prismaMock.sale.create.mock.calls[0][0];
    expect(saleArgs.data.notes).toContain("CMD-20260729-1234");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/sales");
  });

  it("does not touch stock directly — only status, featured flags, and the sale", async () => {
    primeSuccessfulDelivery();
    prismaMock.sale.create.mockResolvedValue({ id: "sale-1" } as never);

    await deliverOrder("order-1");

    expect(prismaMock.productVariant.update).not.toHaveBeenCalled();
  });

  it("retries the sale reference once on a collision, then succeeds", async () => {
    primeSuccessfulDelivery();
    prismaMock.sale.create
      .mockRejectedValueOnce(collisionError())
      .mockResolvedValueOnce({ id: "sale-2" } as never);

    const result = await deliverOrder("order-1");

    expect(result).toEqual({});
    expect(prismaMock.sale.create).toHaveBeenCalledTimes(2);
  });

  it("gives up after 3 sale reference collisions", async () => {
    primeSuccessfulDelivery();
    prismaMock.sale.create.mockRejectedValue(collisionError());

    const result = await deliverOrder("order-1");

    expect(result).toEqual({ error: "referenceCollision" });
    expect(prismaMock.sale.create).toHaveBeenCalledTimes(3);
  });
});

describe("cancelOrder", () => {
  it("rejects an empty reason", async () => {
    const result = await cancelOrder("order-1", "");
    expect(result).toEqual({ error: "invalid" });
  });

  it("returns notFound when the order does not exist", async () => {
    prismaMock.order.findFirst.mockResolvedValue(null);
    const result = await cancelOrder("order-1", "Client injoignable");
    expect(result).toEqual({ error: "notFound" });
  });

  it.each(["PENDING", "DELIVERED", "REJECTED", "CANCELLED"] as const)(
    "returns invalidTransition from %s",
    async (status) => {
      prismaMock.order.findFirst.mockResolvedValue({
        id: "order-1",
        status,
        items: [],
      } as never);
      const result = await cancelOrder("order-1", "Client injoignable");
      expect(result).toEqual({ error: "invalidTransition" });
    },
  );

  it.each(["CONFIRMED", "SHIPPING"] as const)(
    "restocks every line and cancels from %s",
    async (status) => {
      prismaMock.order.findFirst.mockResolvedValue({
        id: "order-1",
        status,
        items: [
          { variantId: "variant-1", quantity: 2 },
          { variantId: "variant-2", quantity: 1 },
        ],
      } as never);

      const result = await cancelOrder("order-1", "Client injoignable");

      expect(result).toEqual({});
      expect(prismaMock.productVariant.update).toHaveBeenCalledWith({
        where: { id: "variant-1" },
        data: { stock: { increment: 2 } },
      });
      expect(prismaMock.productVariant.update).toHaveBeenCalledWith({
        where: { id: "variant-2" },
        data: { stock: { increment: 1 } },
      });
      expect(prismaMock.order.update).toHaveBeenCalledWith({
        where: { id: "order-1" },
        data: expect.objectContaining({
          status: "CANCELLED",
          cancelReason: "Client injoignable",
        }),
      });
    },
  );
});
