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
  trackOrder,
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

// Distinct from collisionError() above: same P2002 code, but raised by the
// promo-phone partial unique index (Order_promoCodeId_customerPhone_active_key)
// rather than the order reference collision — submitOrder must tell the two
// apart via meta.target instead of blindly retrying both the same way.
function promoPhoneRaceError() {
  return new PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
    meta: { target: ["Order_promoCodeId_customerPhone_active_key"] },
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
  // submitOrder reserves stock atomically inside its transaction — default
  // to "reservation succeeded" so tests that aren't specifically about
  // running out of stock don't need to know about this.
  prismaMock.productVariant.updateMany.mockResolvedValue({ count: 1 } as never);
  // The boutique the checkout form claims to be submitted from — validated
  // against this registry, then must line up with baseVariant.product's
  // productType (below) for the happy path.
  getStoreTypesMock.mockReset();
  getStoreTypesMock.mockResolvedValue(STORE_TYPES);
  // findValidPromoCode's feature-flag check (lib/shop/promo-code.ts) — on by
  // default so existing promo-code tests don't need to know about it.
  prismaMock.storeType.findUnique.mockResolvedValue({ couponsEnabled: true } as never);
});

// Only the first bytes matter for signature detection — this doesn't need
// to be a fully decodable PNG.
const PNG_MAGIC_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function buildOrderForm(overrides: Partial<Record<string, string>> = {}) {
  const form = new FormData();
  form.set("customerName", overrides.customerName ?? "Aicha Mint Salem");
  form.set("customerPhone", overrides.customerPhone ?? "22345678");
  form.set("customerCity", overrides.customerCity ?? "Nouakchott");
  form.set("paymentSenderPhone", overrides.paymentSenderPhone ?? "23456789");
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
    // MAX_IMAGE_BYTES is 5 * 1024 * 1024 (5,242,880) — comfortably over that.
    form.set(
      "screenshot",
      new File([new Uint8Array(6_000_000)], "proof.png", { type: "image/png" }),
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

  it("rejects an invalid payment sender phone", async () => {
    const form = buildOrderForm({ paymentSenderPhone: "not-a-phone" });
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

  it("rejects when the boutique's license is suspended, even with valid items in stock", async () => {
    getStoreTypesMock.mockResolvedValue([
      {
        key: "cosmetique",
        licenseType: "MONTHLY",
        licenseStatus: "SUSPENDED",
        licenseExpiresAt: null,
      },
    ]);
    prismaMock.productVariant.findMany.mockResolvedValue([baseVariant] as never);

    const result = await submitOrder(buildOrderForm());

    expect(result).toEqual({ error: "storefrontExpired" });
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

  it("reserves stock atomically at submission and rejects if another request already claimed it", async () => {
    // The pre-transaction snapshot still shows enough stock (10), but the
    // guarded UPDATE inside the transaction is what's authoritative — this
    // is what actually stops two concurrent orders (or the same customer
    // submitting twice) from both succeeding against stock that only
    // covers one of them.
    prismaMock.productVariant.findMany.mockResolvedValue([baseVariant] as never);
    createAdminClientMock.mockReturnValue({
      storage: { from: () => ({ upload: vi.fn().mockResolvedValue({ error: null }) }) },
    });
    prismaMock.productVariant.updateMany.mockResolvedValue({ count: 0 } as never);

    const result = await submitOrder(buildOrderForm());

    expect(result).toEqual({ error: "insufficientStock" });
    expect(prismaMock.productVariant.updateMany).toHaveBeenCalledWith({
      where: { id: "variant-1", stock: { gte: 2 } },
      data: { stock: { decrement: 2 } },
    });
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });

  it("rejects a promo code the same phone number already redeemed on another order", async () => {
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
      maxUses: 5,
      usedCount: 1,
      clientId: null,
      client: null,
    } as never);
    prismaMock.order.findFirst.mockResolvedValue({ id: "earlier-order" } as never);

    const result = await submitOrder(
      buildOrderForm({ promoCode: "FIRST5", customerPhone: "22345678" }),
    );

    expect(result).toEqual({ error: "alreadyUsed" });
    expect(prismaMock.order.findFirst).toHaveBeenCalledWith({
      where: {
        promoCodeId: "promo-1",
        customerPhone: "22345678",
        status: { notIn: ["REJECTED", "CANCELLED"] },
      },
      select: { id: true },
    });
    expect(prismaMock.promoCode.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });

  it("rejects with alreadyUsed when a concurrent submission wins the promo-phone race", async () => {
    // Both requests' priorRedemption read passes (findValidPromoCode has no
    // atomic guard of its own — the partial unique index on Order is what
    // closes the race) but the second Order.create hits the DB constraint.
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
    prismaMock.order.findFirst.mockResolvedValue(null); // priorRedemption: none seen yet
    prismaMock.promoCode.updateMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.order.create.mockRejectedValue(promoPhoneRaceError());

    const result = await submitOrder(
      buildOrderForm({ promoCode: "WELCOME10", customerPhone: "22345678" }),
    );

    expect(result).toEqual({ error: "alreadyUsed" });
    // Unlike a reference collision, this must not retry with a fresh
    // reference — the same phone+code pair would just collide again.
    expect(prismaMock.order.create).toHaveBeenCalledTimes(1);
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

  it("rejects a screenshot over the size limit, as a distinct error from a bad format", async () => {
    prismaMock.productVariant.findMany.mockResolvedValue([baseVariant] as never);
    const form = buildOrderForm({ screenshot: "too-large" });
    const result = await submitOrder(form);
    expect(result).toEqual({ error: "fileTooLarge" });
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
    prismaMock.promoCode.updateMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.order.create.mockResolvedValue({
      id: "order-1",
      reference: "CMD-20260729-1234",
    } as never);

    const result = await submitOrder(buildOrderForm({ promoCode: "welcome10" }));

    expect(result).toEqual({ reference: "CMD-20260729-1234", orderId: "order-1" });
    expect(prismaMock.promoCode.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { code: "WELCOME10" } }),
    );
    // maxUses is null (unlimited) here, so the atomic guard adds no
    // usedCount condition beyond the id match — see the maxUses-set case
    // below for the guarded form.
    expect(prismaMock.promoCode.updateMany).toHaveBeenCalledWith({
      where: { id: "promo-1" },
      data: { usedCount: { increment: 1 } },
    });
    const createArgs = prismaMock.order.create.mock.calls[0][0];
    expect(createArgs.data.subtotal).toBe(3000);
    expect(createArgs.data.discount).toBe(300); // 10% of 3000
    expect(createArgs.data.total).toBe(2700);
    expect(createArgs.data.promoCodeId).toBe("promo-1");
  });

  it("accepts a personal promo code when the phone matches", async () => {
    prismaMock.productVariant.findMany.mockResolvedValue([baseVariant] as never);
    createAdminClientMock.mockReturnValue({
      storage: { from: () => ({ upload: vi.fn().mockResolvedValue({ error: null }) }) },
    });
    prismaMock.promoCode.findUnique.mockResolvedValue({
      id: "promo-2",
      isActive: true,
      productType: "cosmetique",
      discountType: "FIXED",
      discountValue: decimal(500),
      expiresAt: null,
      maxUses: null,
      usedCount: 0,
      clientId: "client-1",
      client: { phone: "22345678" },
    } as never);
    prismaMock.promoCode.updateMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.order.create.mockResolvedValue({
      id: "order-1",
      reference: "CMD-20260729-1234",
    } as never);

    const result = await submitOrder(
      buildOrderForm({ promoCode: "VIP-AICHA", customerPhone: "22345678" }),
    );

    expect(result).toEqual({ reference: "CMD-20260729-1234", orderId: "order-1" });
    const createArgs = prismaMock.order.create.mock.calls[0][0];
    expect(createArgs.data.discount).toBe(500);
    expect(createArgs.data.promoCodeId).toBe("promo-2");
  });

  it("guards the usedCount increment with the maxUses limit atomically", async () => {
    prismaMock.productVariant.findMany.mockResolvedValue([baseVariant] as never);
    createAdminClientMock.mockReturnValue({
      storage: { from: () => ({ upload: vi.fn().mockResolvedValue({ error: null }) }) },
    });
    prismaMock.promoCode.findUnique.mockResolvedValue({
      id: "promo-3",
      isActive: true,
      productType: "cosmetique",
      discountType: "PERCENT",
      discountValue: decimal(10),
      expiresAt: null,
      maxUses: 5,
      usedCount: 4,
      clientId: null,
      client: null,
    } as never);
    prismaMock.promoCode.updateMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.order.create.mockResolvedValue({
      id: "order-1",
      reference: "CMD-20260729-1234",
    } as never);

    await submitOrder(buildOrderForm({ promoCode: "LIMITED" }));

    expect(prismaMock.promoCode.updateMany).toHaveBeenCalledWith({
      where: { id: "promo-3", usedCount: { lt: 5 } },
      data: { usedCount: { increment: 1 } },
    });
  });

  it("rejects when a concurrent request already claimed the last use (race lost)", async () => {
    prismaMock.productVariant.findMany.mockResolvedValue([baseVariant] as never);
    createAdminClientMock.mockReturnValue({
      storage: { from: () => ({ upload: vi.fn().mockResolvedValue({ error: null }) }) },
    });
    prismaMock.promoCode.findUnique.mockResolvedValue({
      id: "promo-3",
      isActive: true,
      productType: "cosmetique",
      discountType: "PERCENT",
      discountValue: decimal(10),
      expiresAt: null,
      maxUses: 1,
      usedCount: 0,
      clientId: null,
      client: null,
    } as never);
    // Another concurrent submit already incremented usedCount to maxUses by
    // the time this one's UPDATE runs — the guarded WHERE matches 0 rows.
    prismaMock.promoCode.updateMany.mockResolvedValue({ count: 0 } as never);

    const result = await submitOrder(buildOrderForm({ promoCode: "LAST-ONE" }));

    expect(result).toEqual({ error: "usageLimitReached" });
    expect(prismaMock.order.create).not.toHaveBeenCalled();
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
    expect(prismaMock.promoCode.updateMany).not.toHaveBeenCalled();
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
    } as never);
    const result = await confirmOrder("order-1");
    expect(result).toEqual({ error: "notPending" });
  });

  it("marks the order CONFIRMED and revalidates — stock was already reserved at submission", async () => {
    prismaMock.order.findFirst.mockResolvedValue({
      id: "order-1",
      reference: "CMD-20260729-1234",
      status: "PENDING",
    } as never);

    const result = await confirmOrder("order-1");

    expect(result).toEqual({});
    expect(prismaMock.productVariant.updateMany).not.toHaveBeenCalled();
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

  it("returns notFound when the order does not exist", async () => {
    prismaMock.order.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.order.findFirst.mockResolvedValue(null);
    const result = await rejectOrder("order-1", "Rupture de stock");
    expect(result).toEqual({ error: "notFound" });
  });

  it("returns notPending when the order already moved on", async () => {
    // The guarded updateMany's WHERE (status: "PENDING") is what actually
    // rejects this — the order existing with some other status is enough
    // to distinguish notPending from notFound below.
    prismaMock.order.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.order.findFirst.mockResolvedValue({ id: "order-1" } as never);
    const result = await rejectOrder("order-1", "Rupture de stock");
    expect(result).toEqual({ error: "notPending" });
  });

  it("gives back reserved stock and rejects a pending order with the given reason", async () => {
    prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({
      id: "order-1",
      reference: "CMD-20260729-1234",
      promoCodeId: null,
      items: [
        { variantId: "variant-1", quantity: 2 },
        { variantId: "variant-2", quantity: 1 },
      ],
    } as never);

    const result = await rejectOrder("order-1", "Rupture de stock");

    expect(result).toEqual({});
    // The status flip is the concurrency gate — it must happen via a
    // guarded updateMany, not a plain read-then-write, so two concurrent
    // rejects of the same order can't both pass.
    expect(prismaMock.order.updateMany).toHaveBeenCalledWith({
      where: { id: "order-1", productType: "cosmetique", status: "PENDING" },
      data: expect.objectContaining({
        status: "REJECTED",
        rejectReason: "Rupture de stock",
      }),
    });
    expect(prismaMock.productVariant.update).toHaveBeenCalledWith({
      where: { id: "variant-1" },
      data: { stock: { increment: 2 } },
    });
    expect(prismaMock.productVariant.update).toHaveBeenCalledWith({
      where: { id: "variant-2" },
      data: { stock: { increment: 1 } },
    });
    expect(prismaMock.promoCode.update).not.toHaveBeenCalled();
  });

  it("frees up the promo code's usedCount so the same phone can try again", async () => {
    prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({
      id: "order-1",
      reference: "CMD-20260729-1234",
      promoCodeId: "promo-1",
      items: [{ variantId: "variant-1", quantity: 1 }],
    } as never);

    await rejectOrder("order-1", "Capture illisible");

    expect(prismaMock.promoCode.update).toHaveBeenCalledWith({
      where: { id: "promo-1" },
      data: { usedCount: { decrement: 1 } },
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
    prismaMock.order.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.order.findFirst.mockResolvedValue(null);
    const result = await cancelOrder("order-1", "Client injoignable");
    expect(result).toEqual({ error: "notFound" });
  });

  it("returns invalidTransition when the order exists but isn't CONFIRMED or SHIPPING", async () => {
    // The guarded updateMany's WHERE (status: { in: [CONFIRMED, SHIPPING] })
    // is what actually rejects this regardless of the order's real status —
    // existing at all is enough to distinguish this from notFound above.
    prismaMock.order.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.order.findFirst.mockResolvedValue({ id: "order-1" } as never);
    const result = await cancelOrder("order-1", "Client injoignable");
    expect(result).toEqual({ error: "invalidTransition" });
  });

  it.each(["CONFIRMED", "SHIPPING"] as const)(
    "restocks every line and cancels from %s",
    async (_status) => {
      prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.order.findUniqueOrThrow.mockResolvedValue({
        id: "order-1",
        promoCodeId: null,
        items: [
          { variantId: "variant-1", quantity: 2 },
          { variantId: "variant-2", quantity: 1 },
        ],
      } as never);

      const result = await cancelOrder("order-1", "Client injoignable");

      expect(result).toEqual({});
      // The status flip is the concurrency gate — guarded updateMany, not a
      // plain read-then-write, so two concurrent cancels can't both refund.
      expect(prismaMock.order.updateMany).toHaveBeenCalledWith({
        where: {
          id: "order-1",
          productType: "cosmetique",
          status: { in: ["CONFIRMED", "SHIPPING"] },
        },
        data: expect.objectContaining({
          status: "CANCELLED",
          cancelReason: "Client injoignable",
        }),
      });
      expect(prismaMock.productVariant.update).toHaveBeenCalledWith({
        where: { id: "variant-1" },
        data: { stock: { increment: 2 } },
      });
      expect(prismaMock.productVariant.update).toHaveBeenCalledWith({
        where: { id: "variant-2" },
        data: { stock: { increment: 1 } },
      });
    },
  );

  it("frees up the promo code's usedCount when cancelling an order that used one", async () => {
    prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({
      id: "order-1",
      promoCodeId: "promo-1",
      items: [{ variantId: "variant-1", quantity: 1 }],
    } as never);

    await cancelOrder("order-1", "Client injoignable");

    expect(prismaMock.promoCode.update).toHaveBeenCalledWith({
      where: { id: "promo-1" },
      data: { usedCount: { decrement: 1 } },
    });
  });
});

describe("trackOrder", () => {
  it("returns invalid for a malformed phone or a blank reference", async () => {
    const result = await trackOrder({
      phone: "not-a-phone",
      reference: "",
      productType: "sport",
    });

    expect(result).toEqual({ error: "invalid" });
    expect(prismaMock.order.findFirst).not.toHaveBeenCalled();
  });

  it("rejects with rateLimited and does no lookup when the caller's IP is over the limit", async () => {
    headersMock.mockResolvedValue({
      get: (name: string) => (name === "x-forwarded-for" ? "203.0.113.9" : null),
    });
    prismaMock.rateLimitHit.count.mockResolvedValue(10);

    const result = await trackOrder({
      phone: "37737353",
      reference: "CMD-20260815-1234",
      productType: "sport",
    });

    expect(result).toEqual({ error: "rateLimited" });
    expect(prismaMock.order.findFirst).not.toHaveBeenCalled();
  });

  it("returns notFound when phone and reference don't both match", async () => {
    prismaMock.order.findFirst.mockResolvedValue(null);

    const result = await trackOrder({
      phone: "37737353",
      reference: "CMD-20260815-1234",
      productType: "sport",
    });

    expect(result).toEqual({ error: "notFound" });
  });

  it("scopes the lookup by phone, reference, and productType together", async () => {
    prismaMock.order.findFirst.mockResolvedValue({
      reference: "CMD-20260815-1234",
      status: "CONFIRMED",
      total: { toNumber: () => 3600 },
      createdAt: new Date("2026-08-15T10:00:00Z"),
      confirmedAt: new Date("2026-08-15T12:00:00Z"),
      shippedAt: null,
      deliveredAt: null,
      rejectedAt: null,
      cancelledAt: null,
    } as never);

    const result = await trackOrder({
      phone: "37737353",
      reference: "cmd-20260815-1234",
      productType: "sport",
    });

    expect(prismaMock.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          customerPhone: "37737353",
          reference: "CMD-20260815-1234",
          productType: "sport",
        },
      }),
    );
    expect(result).toEqual({
      reference: "CMD-20260815-1234",
      status: "CONFIRMED",
      total: 3600,
      createdAt: new Date("2026-08-15T10:00:00Z"),
      statusSince: new Date("2026-08-15T12:00:00Z"),
    });
  });

  it("uses createdAt as statusSince while an order is still PENDING", async () => {
    prismaMock.order.findFirst.mockResolvedValue({
      reference: "CMD-20260815-1234",
      status: "PENDING",
      total: { toNumber: () => 3600 },
      createdAt: new Date("2026-08-15T10:00:00Z"),
      confirmedAt: null,
      shippedAt: null,
      deliveredAt: null,
      rejectedAt: null,
      cancelledAt: null,
    } as never);

    const result = await trackOrder({
      phone: "37737353",
      reference: "CMD-20260815-1234",
      productType: "sport",
    });

    expect(result).toMatchObject({ statusSince: new Date("2026-08-15T10:00:00Z") });
  });
});
