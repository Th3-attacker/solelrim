"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getVariantPrice } from "@/lib/shop/price";

// A real cart never has more than a handful of distinct line items — caps
// the query size regardless of what a caller sends.
const MAX_VARIANT_IDS = 50;
const inputSchema = z.object({
  productType: z.string().min(1),
  variantIds: z.array(z.string().min(1)).max(MAX_VARIANT_IDS),
});

// Fires on every cart-open, not just a rare action like login/checkout —
// generous limit sized for normal browsing (opening/closing the cart
// repeatedly while shopping), not the abuse-deterrent windows used elsewhere.
const GET_VARIANT_STOCKS_RATE_LIMIT = { windowMs: 15 * 60 * 1000, max: 60 };

// The cart persists in localStorage with a stock snapshot taken at
// add-to-cart time, which can go stale (another sale, an admin adjusting
// stock, or the visitor just coming back days later). Public and
// unauthenticated by design — this only ever reveals a stock count for
// variants the caller already knows the id of, same as the storefront
// itself already shows.
//
// Returns null (not `{}`) on invalid input or when rate-limited — the
// caller's cart-sync reducer treats any variant absent from the returned
// map as 0 in stock and drops it, so an empty object here would read as
// "everything in the cart just sold out" and wipe it. null tells the
// caller to skip syncing this time instead.
export async function getVariantStocks(
  productType: string,
  variantIds: string[],
): Promise<Record<string, number> | null> {
  const parsed = inputSchema.safeParse({ productType, variantIds });
  if (!parsed.success) return null;
  if (parsed.data.variantIds.length === 0) return {};

  const ip = await getClientIp();
  const allowed = await checkRateLimit(`variant-stocks:${ip}`, GET_VARIANT_STOCKS_RATE_LIMIT);
  if (!allowed) return null;

  const variants = await prisma.productVariant.findMany({
    where: { id: { in: parsed.data.variantIds }, product: { productType: parsed.data.productType } },
    select: { id: true, stock: true },
  });

  return Object.fromEntries(variants.map((v) => [v.id, v.stock]));
}

export type SharedCartLine = {
  variantId: string;
  productId: string;
  productName: string;
  size: string;
  color: string;
  unitPrice: number;
  imageStoragePath: string | null;
  stock: number;
  quantity: number;
};

const sharedCartEntrySchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(1),
});
const sharedCartInputSchema = z.object({
  productType: z.string().min(1),
  entries: z.array(sharedCartEntrySchema).max(MAX_VARIANT_IDS),
});

// Same rate-limit shape as getVariantStocks above — this fires once per
// visit to a shared-cart link, not per keystroke, but still worth capping.
const RESOLVE_SHARED_CART_RATE_LIMIT = { windowMs: 15 * 60 * 1000, max: 30 };

// The cart itself only ever lives in the recipient's own localStorage —
// there's no server-side cart to fetch by id. A "share cart" link instead
// carries {variantId, quantity} pairs in its query string, and this
// resolves those back into full, live cart lines (current name/price/
// image/stock) the same way the product page would build them for an
// add-to-cart. A variant that's gone, deactivated, or moved to another
// boutique since the link was made is silently dropped rather than erroring
// the whole import — same "best effort" degradation as getVariantStocks.
export async function resolveSharedCartLines(
  productType: string,
  entries: { variantId: string; quantity: number }[],
): Promise<SharedCartLine[]> {
  const parsed = sharedCartInputSchema.safeParse({ productType, entries });
  if (!parsed.success || parsed.data.entries.length === 0) return [];

  const ip = await getClientIp();
  const allowed = await checkRateLimit(
    `resolve-shared-cart:${ip}`,
    RESOLVE_SHARED_CART_RATE_LIMIT,
  );
  if (!allowed) return [];

  const quantityByVariantId = new Map(
    parsed.data.entries.map((e) => [e.variantId, e.quantity]),
  );

  const variants = await prisma.productVariant.findMany({
    where: {
      id: { in: [...quantityByVariantId.keys()] },
      product: { productType: parsed.data.productType, isActive: true },
    },
    include: {
      product: {
        include: { images: { take: 1, orderBy: { position: "asc" } } },
      },
    },
  });

  return variants
    .map((variant) => {
      const requested = quantityByVariantId.get(variant.id) ?? 0;
      return {
        variantId: variant.id,
        productId: variant.productId,
        productName: variant.product.name,
        size: variant.size,
        color: variant.color,
        unitPrice: getVariantPrice(variant, variant.product.basePrice),
        imageStoragePath: variant.product.images[0]?.storagePath ?? null,
        stock: variant.stock,
        quantity: Math.min(requested, variant.stock),
      };
    })
    .filter((line) => line.quantity > 0);
}
