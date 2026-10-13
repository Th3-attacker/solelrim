import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStoreTypes } from "@/lib/queries/settings";
import {
  checkoutCustomerSchema,
  idempotencyKeySchema,
  orderItemsSchema,
  paymentSenderPhoneSchema,
  trackOrderSchema,
} from "@/lib/validation/order";
import type { OrderStatus, StoreType } from "@/lib/generated/prisma/client";
import { buildOrderReference } from "@/lib/shop/reference";
import { PrismaClientKnownRequestError } from "@/lib/generated/prisma/internal/prismaNamespace";
import { routing } from "@/i18n/routing";
import {
  getClientIp,
  peekRateLimit,
  RATE_LIMITS,
  rateLimitRetryAfter,
  recordRateLimitHit,
} from "@/lib/rate-limit";
import { validateImageBytes, MAX_IMAGE_BYTES } from "@/lib/shop/image-signature";
import { getEffectiveLicenseState, isLicenseBlocking } from "@/lib/shop/license";
import { findValidPromoCode, computePromoDiscount, isPromoCodeError } from "@/lib/shop/promo-code";
import { findOrderByIdempotencyKey } from "@/lib/queries/orders";
import { getProductImageUrl } from "@/lib/supabase/storage";
import { PAYMENT_PROOFS_BUCKET } from "@/lib/supabase/payment-proofs";
import { revalidateAdmin } from "@/lib/revalidate";

// Placing and tracking an order, the customer side: the website's Server
// Actions (lib/actions/orders.ts) and the app's API routes (app/api/v1) both
// call these, so prices, stock, promo codes, the payment proof check and the
// rate limits exist once.

export type PlaceOrderResult = {
  error?: string;
  // With "rateLimited": seconds until the caller may try again.
  retryAfter?: number;
  reference?: string;
  orderId?: string;
};

// The fields of an order as both entry points receive them: the website's
// checkout form and the app's multipart body carry the same names. Raw
// values, validated by placeOrder.
export type OrderInput = Record<
  | "customerName"
  | "customerPhone"
  | "customerCity"
  | "paymentSenderPhone"
  | "locale"
  | "productType"
  | "items"
  | "promoCode"
  | "paymentTransactionId"
  | "screenshot",
  FormDataEntryValue | null
>;

export function orderInputFrom(formData: FormData): OrderInput {
  return {
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone"),
    customerCity: formData.get("customerCity"),
    paymentSenderPhone: formData.get("paymentSenderPhone"),
    locale: formData.get("locale"),
    productType: formData.get("productType"),
    items: formData.get("items"),
    promoCode: formData.get("promoCode"),
    paymentTransactionId: formData.get("paymentTransactionId"),
    screenshot: formData.get("screenshot"),
  };
}

type Refusal = { error: string; retryAfter?: number };

function isRefusal<T extends object>(value: T | Refusal): value is Refusal {
  return "error" in value;
}

// idempotencyKey (optional): the same on every resend of one order — the
// app's Idempotency-Key header, the website's checkout attempt. A resend whose
// first try already went through (the answer was lost on a bad connection)
// gets that order back instead of placing a second one: no stock or promo
// code taken twice.
export async function placeOrder(
  input: OrderInput,
  options?: { idempotencyKey?: string },
): Promise<PlaceOrderResult> {
  const idempotencyKey = options?.idempotencyKey;
  if (idempotencyKey === undefined) return createOrder(input, null);
  if (!idempotencyKeySchema.safeParse(idempotencyKey).success) {
    return { error: "invalid" };
  }

  // Looked up only in the boutique the input names: createOrder checks that
  // value against the registry, and a key only ever matches its own boutique.
  const { productType } = input;
  if (typeof productType !== "string") return { error: "invalid" };

  const earlier = await findOrderByIdempotencyKey(productType, idempotencyKey);
  if (earlier) return earlier;

  const result = await createOrder(input, idempotencyKey);
  if (!result.error) return result;
  // Two sends of the same order side by side: the one that lost may stop
  // early (the winner took the last unit, or the rate limit) — the order
  // exists all the same, so it gets the winner's answer.
  return (await findOrderByIdempotencyKey(productType, idempotencyKey)) ?? result;
}

// Every check runs before the payment proof is uploaded, cheapest first; the
// transaction at the end is what actually settles stock and promo codes
// against concurrent orders.
async function createOrder(
  input: OrderInput,
  idempotencyKey: string | null,
): Promise<PlaceOrderResult> {
  const customer = await checkCustomer(input);
  if (isRefusal(customer)) return customer;

  const order = await readOrder(input);
  if (isRefusal(order)) return order;

  const lines = await priceLines(order.storeType.key, order.items);
  if (isRefusal(lines)) return lines;

  const payment = await readPayment(input, order.storeType.key);
  if (isRefusal(payment)) return payment;

  const proof = await uploadPaymentProof(input.screenshot);
  if (isRefusal(proof)) return proof;

  return saveOrder({ customer, order, lines, payment, proof, idempotencyKey });
}

// Public and unauthenticated, with a file upload: capped so it can't spam
// Storage or flood the admin with fake orders (see RATE_LIMITS) — per IP
// first, per phone once the customer's details are read.
async function checkCustomer(input: OrderInput) {
  const ip = await getClientIp();
  const ipWait = await rateLimitRetryAfter(`order:${ip}`, RATE_LIMITS.orderPerIp);
  if (ipWait !== null) {
    return { error: "rateLimited", retryAfter: ipWait };
  }

  const customerParsed = checkoutCustomerSchema.safeParse({
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    customerCity: input.customerCity,
  });
  if (!customerParsed.success) {
    return { error: "invalid" };
  }
  const phoneWait = await rateLimitRetryAfter(
    `order-phone:${customerParsed.data.customerPhone}`,
    RATE_LIMITS.orderPerPhone,
  );
  if (phoneWait !== null) {
    return { error: "rateLimited", retryAfter: phoneWait };
  }
  return customerParsed.data;
}

function resolveOrderLocale(value: FormDataEntryValue | null): string {
  const locales: readonly string[] = routing.locales;
  return typeof value === "string" && locales.includes(value)
    ? value
    : routing.defaultLocale;
}

type ReadOrder = {
  senderPhone: string;
  locale: string;
  storeType: StoreType;
  items: { variantId: string; quantity: number }[];
};

async function readOrder(input: OrderInput): Promise<ReadOrder | Refusal> {
  const senderPhoneParsed = paymentSenderPhoneSchema.safeParse(input.paymentSenderPhone);
  if (!senderPhoneParsed.success) {
    return { error: "invalid" };
  }

  const locale = resolveOrderLocale(input.locale);

  // The checkout form sends the boutique it was submitted from (the URL's
  // [storeType] segment) — client-supplied, so it's only trusted once
  // checked against the real registry, same as any other form input.
  const storeTypes = await getStoreTypes();
  const storeType = storeTypes.find((type) => type.key === input.productType);
  if (typeof input.productType !== "string" || !storeType) {
    return { error: "invalid" };
  }

  // Belt-and-suspenders: the (shop) layout already blocks every page once
  // the license is suspended/expired/cancelled, so this only matters for a
  // tab left open across that moment — same rule, checked again
  // server-side before an order can actually be created.
  if (isLicenseBlocking(getEffectiveLicenseState(storeType))) {
    return { error: "storefrontExpired" };
  }

  let rawItems: unknown;
  try {
    rawItems = JSON.parse(String(input.items ?? "[]"));
  } catch {
    return { error: "invalid" };
  }
  const itemsParsed = orderItemsSchema.safeParse(rawItems);
  if (!itemsParsed.success) {
    return { error: "invalid" };
  }

  return { senderPhone: senderPhoneParsed.data, locale, storeType, items: itemsParsed.data };
}

type PricedLines = {
  orderItems: { variantId: string; quantity: number; unitPrice: number; lineTotal: number }[];
  subtotal: number;
};

// Prices come from the database, never from the client.
async function priceLines(
  productType: string,
  items: ReadOrder["items"],
): Promise<PricedLines | Refusal> {
  const variantIds = items.map((i) => i.variantId);
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    include: { product: true },
  });
  const variantById = new Map(variants.map((v) => [v.id, v]));

  if (variantById.size !== new Set(variantIds).size) {
    return { error: "invalid" };
  }

  // The cart is scoped to one boutique client-side (per-boutique localStorage
  // key), but nothing stops a crafted request from mixing variant ids across
  // boutiques — reject rather than create an order that misattributes one.
  if (variants.some((v) => v.product.productType !== productType)) {
    return { error: "invalid" };
  }

  // A product the admin took off sale can still sit in a cart saved before
  // that (or be sent by a crafted request). Answered like a sold-out item: the
  // checkout goes back to the cart, whose stock check shows it unavailable.
  if (variants.some((v) => !v.product.isActive)) {
    return { error: "insufficientStock" };
  }

  const orderItems = items.map((item) => {
    const variant = variantById.get(item.variantId)!;
    const unitPrice = (variant.price ?? variant.product.basePrice).toNumber();
    return {
      variantId: item.variantId,
      quantity: item.quantity,
      unitPrice,
      lineTotal: unitPrice * item.quantity,
      variantStock: variant.stock,
    };
  });

  // Fast-fail on an obviously stale cart before spending effort on the
  // upload — the atomic decrement inside the transaction below is what
  // actually enforces this against concurrent submissions; this is just a
  // cheap early exit for the common case.
  if (orderItems.some((item) => item.variantStock < item.quantity)) {
    return { error: "insufficientStock" };
  }

  return {
    orderItems: orderItems.map(({ variantStock: _, ...item }) => item),
    subtotal: orderItems.reduce((sum, i) => sum + i.lineTotal, 0),
  };
}

async function readPayment(
  input: OrderInput,
  productType: string,
): Promise<{ promoCode: string | null; paymentTransactionId: string | null } | Refusal> {
  // Optional — a blank/missing code just means no discount, not an error.
  const promoCode =
    typeof input.promoCode === "string" && input.promoCode.trim() ? input.promoCode.trim() : null;

  // Optional — the id the wallet showed for the transfer. Normalized so the
  // same id typed twice ("ab12 " / "AB12") is seen as the same.
  const paymentTransactionId =
    typeof input.paymentTransactionId === "string" && input.paymentTransactionId.trim()
      ? input.paymentTransactionId.trim().toUpperCase()
      : null;
  if (paymentTransactionId && paymentTransactionId.length > 64) {
    return { error: "invalid" };
  }
  // Fast-fail before the upload; the partial unique index on Order is what
  // actually settles two orders racing with the same id.
  if (paymentTransactionId) {
    const used = await prisma.order.findFirst({
      where: {
        productType,
        paymentTransactionId,
        status: { notIn: ["REJECTED", "CANCELLED"] },
      },
      select: { id: true },
    });
    if (used) {
      return { error: "transactionAlreadyUsed" };
    }
  }

  return { promoCode, paymentTransactionId };
}

type UploadedProof = {
  storagePath: string;
  paymentProofHash: string;
  // Every path that gives up after the upload must call this, or the proof
  // stays in Storage forever. Best-effort: a failed cleanup never masks the
  // real outcome.
  discard: () => Promise<void>;
};

async function uploadPaymentProof(file: FormDataEntryValue | null): Promise<UploadedProof | Refusal> {
  if (!(file instanceof File) || file.size === 0) {
    return { error: "invalidFile" };
  }
  // Checked as its own case (not folded into "invalidFile") so the client
  // can tell the customer exactly what's wrong — checkout-flow.tsx already
  // rejects an oversized pick before it ever uploads, this is the
  // server-side backstop for a request built some other way.
  if (file.size > MAX_IMAGE_BYTES) {
    return { error: "fileTooLarge" };
  }

  // File.type is whatever the browser guessed from the filename — trust the
  // actual bytes instead, so a renamed non-image (or a small-on-disk pixel
  // bomb) can't pass as a "photo".
  const fileBuffer = await file.arrayBuffer();
  const detected = validateImageBytes(new Uint8Array(fileBuffer));
  if (!detected) {
    return { error: "invalidFile" };
  }

  // The same image on another order is flagged to the admin (see
  // getOrdersSharingPaymentProof), not refused here.
  const paymentProofHash = createHash("sha256").update(new Uint8Array(fileBuffer)).digest("hex");

  const supabase = createAdminClient();
  const storagePath = `orders/${crypto.randomUUID()}.${detected.extension}`;
  const { error: uploadError } = await supabase.storage
    .from(PAYMENT_PROOFS_BUCKET)
    .upload(storagePath, fileBuffer, { contentType: detected.contentType });
  if (uploadError) {
    return { error: "uploadFailed" };
  }

  return {
    storagePath,
    paymentProofHash,
    discard: async () => {
      try {
        await supabase.storage.from(PAYMENT_PROOFS_BUCKET).remove([storagePath]);
      } catch {
        // swallow — nothing actionable, and the original outcome still stands
      }
    },
  };
}

async function saveOrder({
  customer,
  order: { senderPhone, locale, storeType },
  lines: { orderItems, subtotal },
  payment: { promoCode, paymentTransactionId },
  proof,
  idempotencyKey,
}: {
  customer: { customerName: string; customerPhone: string; customerCity: string };
  order: ReadOrder;
  lines: PricedLines;
  payment: { promoCode: string | null; paymentTransactionId: string | null };
  proof: UploadedProof;
  idempotencyKey: string | null;
}): Promise<PlaceOrderResult> {
  const productType = storeType.key;

  for (let attempt = 0; attempt < 3; attempt++) {
    const reference = buildOrderReference();
    try {
      const order = await prisma.$transaction(async (tx) => {
        // Reserve stock now, not at admin confirmation — otherwise several
        // orders (the same customer placing more than one, or different
        // customers) can each pass the earlier fast-fail check and all get
        // a "success" screen for stock that only covers one of them, and
        // the conflict only surfaces later when an admin tries to confirm
        // them one by one. The gte guard in the WHERE closes the same
        // read-then-write race the promo-code increment below already
        // guards against: whichever request's update lands first wins.
        for (const item of orderItems) {
          const updated = await tx.productVariant.updateMany({
            where: { id: item.variantId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });
          if (updated.count === 0) {
            throw new Error("insufficientStock");
          }
        }

        // Re-validated from scratch here, inside the same transaction that
        // increments usedCount — never trusts whatever the checkout preview
        // (previewPromoCode) showed the customer, which could be stale by
        // the time this submits (code deactivated, limit hit by someone
        // else, etc).
        let discount = 0;
        let promoCodeId: string | null = null;
        if (promoCode) {
          const result = await findValidPromoCode(tx, {
            code: promoCode,
            productType,
            customerPhone: customer.customerPhone,
          });
          if ("error" in result) {
            throw new Error(result.error);
          }
          discount = computePromoDiscount(result.promoCode, subtotal);
          promoCodeId = result.promoCode.id;
          const { maxUses } = result.promoCode;
          // The read above and this increment aren't atomic on their own —
          // under READ COMMITTED, two concurrent submits for the same
          // maxUses-limited code could both pass the check before either
          // commits. Re-asserting usedCount < maxUses in the UPDATE's WHERE
          // closes that gap: if someone else's increment lands first,
          // updated.count is 0 here and this one loses the race instead of
          // silently overselling the code.
          const updated = await tx.promoCode.updateMany({
            where: {
              id: promoCodeId,
              ...(maxUses !== null ? { usedCount: { lt: maxUses } } : {}),
            },
            data: { usedCount: { increment: 1 } },
          });
          if (updated.count === 0) {
            throw new Error("usageLimitReached");
          }
        }

        return tx.order.create({
          data: {
            reference,
            customerName: customer.customerName,
            customerPhone: customer.customerPhone,
            customerCity: customer.customerCity,
            subtotal,
            discount,
            total: Math.max(subtotal - discount, 0),
            promoCodeId,
            paymentProofPath: proof.storagePath,
            paymentSenderPhone: senderPhone,
            paymentTransactionId,
            paymentProofHash: proof.paymentProofHash,
            locale,
            productType,
            idempotencyKey,
            items: {
              create: orderItems.map((i) => ({
                variantId: i.variantId,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                lineTotal: i.lineTotal,
              })),
            },
          },
        });
      });
      revalidateAdmin();
      return { reference: order.reference, orderId: order.id };
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === "P2002") {
        // Two distinct unique constraints can raise P2002 here: the order
        // reference (retry with a fresh one) and, since this Order.create,
        // the promo-phone partial unique index (see migration
        // 20260817090000_promo_phone_unique_index) — a concurrent
        // submission for the same phone + code just won that race.
        const target = Array.isArray(err.meta?.target)
          ? err.meta.target.join(",")
          : String(err.meta?.target ?? "");
        // A resend with the same Idempotency-Key committed first (the app's
        // two requests ran side by side). This transaction rolled back, so
        // nothing was reserved twice: answer with the order that won.
        if (idempotencyKey && target.includes("idempotencyKey")) {
          await proof.discard();
          const existing = await findOrderByIdempotencyKey(productType, idempotencyKey);
          if (existing) return existing;
          return { error: "invalid" };
        }
        if (target.includes("paymentTransactionId")) {
          await proof.discard();
          return { error: "transactionAlreadyUsed" };
        }
        if (target.includes("promoCodeId_customerPhone")) {
          await proof.discard();
          return { error: "alreadyUsed" };
        }
        continue;
      }
      if (err instanceof Error && err.message === "insufficientStock") {
        await proof.discard();
        return { error: "insufficientStock" };
      }
      if (err instanceof Error && isPromoCodeError(err.message)) {
        await proof.discard();
        return { error: err.message };
      }
      await proof.discard();
      throw err;
    }
  }

  await proof.discard();
  return { error: "referenceCollision" };
}

export type TrackOrderResult =
  | { error: string; retryAfter?: number }
  | {
      reference: string;
      status: OrderStatus;
      total: number;
      createdAt: Date;
      // When the current status was reached — createdAt for PENDING,
      // otherwise the matching *At column. Lets the UI say "no movement
      // in N days" instead of just "ordered N days ago", which would
      // misfire on an order that's already progressing normally.
      statusSince: Date;
      subtotal: number;
      discount: number;
      // What was ordered, at the price paid — so an app reinstalled on a new
      // phone (it only kept phone + reference) can show the order again.
      items: TrackedOrderItem[];
    };

export type TrackedOrderItem = {
  variantId: string;
  productName: string;
  productSlug: string;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  // The product photo of that color, else its first photo.
  imageUrl: string | null;
};

// The wait to announce when several limits block at once: the longest.
function longestWait(waits: (number | null)[]): number | null {
  const blocking = waits.filter((wait): wait is number => wait !== null);
  return blocking.length > 0 ? Math.max(...blocking) : null;
}

function getStatusSince(order: {
  status: OrderStatus;
  createdAt: Date;
  confirmedAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  rejectedAt: Date | null;
  cancelledAt: Date | null;
}): Date {
  switch (order.status) {
    case "CONFIRMED":
      return order.confirmedAt ?? order.createdAt;
    case "SHIPPING":
      return order.shippedAt ?? order.createdAt;
    case "DELIVERED":
      return order.deliveredAt ?? order.createdAt;
    case "REJECTED":
      return order.rejectedAt ?? order.createdAt;
    case "CANCELLED":
      return order.cancelledAt ?? order.createdAt;
    default:
      return order.createdAt;
  }
}

// Public, unauthenticated lookup: the exact reference is needed alongside
// the phone number, so knowing someone's number alone shows nothing. The
// limits (RATE_LIMITS.track*) tell guessing (failed lookups, held tight)
// from a customer following their order (counted per order, generously, and
// never per IP alone).
export async function trackOrder(input: unknown): Promise<TrackOrderResult> {
  const ip = await getClientIp();
  const ipWait = await rateLimitRetryAfter(`track-ip:${ip}`, RATE_LIMITS.trackPerIp);
  if (ipWait !== null) {
    return { error: "rateLimited", retryAfter: ipWait };
  }

  const parsed = trackOrderSchema.safeParse(input);
  // The phone alone, when well-formed, so a blank reference still counts
  // against that number.
  const phoneOnly = trackOrderSchema.shape.phone.safeParse((input as { phone?: unknown } | null)?.phone);
  const phone = phoneOnly.success ? phoneOnly.data : null;

  // Checked before the lookup, the right pair included: letting it through
  // would turn "429 vs 200" into an unlimited oracle for guessing.
  const failureWaits = await Promise.all([
    peekRateLimit(`track-fail-ip:${ip}`, RATE_LIMITS.trackFailurePerIp),
    phone ? peekRateLimit(`track-fail-phone:${phone}`, RATE_LIMITS.trackFailurePerPhone) : null,
  ]);
  const failureWait = longestWait(failureWaits);
  if (failureWait !== null) {
    return { error: "rateLimited", retryAfter: failureWait };
  }

  const recordFailure = () =>
    Promise.all([
      recordRateLimitHit(`track-fail-ip:${ip}`),
      phone ? recordRateLimitHit(`track-fail-phone:${phone}`) : null,
    ]);

  if (!parsed.success) {
    await recordFailure();
    return { error: "invalid" };
  }

  const order = await prisma.order.findFirst({
    where: {
      customerPhone: parsed.data.phone,
      reference: parsed.data.reference.toUpperCase(),
      productType: parsed.data.productType,
    },
    select: {
      reference: true,
      status: true,
      total: true,
      createdAt: true,
      confirmedAt: true,
      shippedAt: true,
      deliveredAt: true,
      rejectedAt: true,
      cancelledAt: true,
      subtotal: true,
      discount: true,
      items: {
        orderBy: { id: "asc" },
        select: {
          variantId: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
          variant: {
            select: {
              size: true,
              color: true,
              product: {
                select: {
                  name: true,
                  slug: true,
                  images: { orderBy: { position: "asc" }, select: { storagePath: true, color: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!order) {
    await recordFailure();
    return { error: "notFound" };
  }

  const successWait = await rateLimitRetryAfter(
    `track-ok:${parsed.data.productType}:${order.reference}`,
    RATE_LIMITS.trackSuccessPerOrder,
  );
  if (successWait !== null) {
    return { error: "rateLimited", retryAfter: successWait };
  }

  return {
    reference: order.reference,
    status: order.status,
    total: order.total.toNumber(),
    createdAt: order.createdAt,
    statusSince: getStatusSince(order),
    subtotal: order.subtotal.toNumber(),
    discount: order.discount.toNumber(),
    items: order.items.map(({ variant, ...item }) => {
      const { images } = variant.product;
      const image = images.find((candidate) => candidate.color === variant.color) ?? images[0];
      return {
        variantId: item.variantId,
        productName: variant.product.name,
        productSlug: variant.product.slug,
        size: variant.size,
        color: variant.color,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toNumber(),
        lineTotal: item.lineTotal.toNumber(),
        imageUrl: image ? getProductImageUrl(image.storagePath) : null,
      };
    }),
  };
}
