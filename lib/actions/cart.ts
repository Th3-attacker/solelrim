"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

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
