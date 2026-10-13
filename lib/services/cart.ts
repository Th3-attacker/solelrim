import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp, RATE_LIMITS, rateLimitRetryAfter } from "@/lib/rate-limit";

// A real cart never has more than a handful of distinct line items — caps
// the query size regardless of what a caller sends.
export const MAX_CART_LINES = 50;
const inputSchema = z.object({
  productType: z.string().min(1),
  variantIds: z.array(z.string().min(1)).max(MAX_CART_LINES),
});

// The cart's stock check (the website's getVariantStocks, the app's
// POST .../stocks). A malformed list (the caller should fix its request) is
// told apart from a rate limit (wait retryAfter seconds).
export async function checkVariantStocks(
  productType: string,
  variantIds: string[],
): Promise<
  { stocks: Record<string, number> } | { error: "invalid" } | { error: "rateLimited"; retryAfter: number }
> {
  const parsed = inputSchema.safeParse({ productType, variantIds });
  if (!parsed.success) return { error: "invalid" };
  if (parsed.data.variantIds.length === 0) return { stocks: {} };

  const ip = await getClientIp();
  const wait = await rateLimitRetryAfter(`variant-stocks:${ip}`, RATE_LIMITS.stocksPerIp);
  if (wait !== null) return { error: "rateLimited", retryAfter: wait };

  // A product taken off sale is left out like a variant that no longer
  // exists: the cart drops it, as placeOrder would refuse it.
  const variants = await prisma.productVariant.findMany({
    where: {
      id: { in: parsed.data.variantIds },
      product: { productType: parsed.data.productType, isActive: true },
    },
    select: { id: true, stock: true },
  });

  return { stocks: Object.fromEntries(variants.map((v) => [v.id, v.stock])) };
}
