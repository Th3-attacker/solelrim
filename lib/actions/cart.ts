"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { MAX_CART_LINES } from "@/lib/services/cart";
import { getVariantPrice } from "@/lib/shop/price";

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
  entries: z.array(sharedCartEntrySchema).max(MAX_CART_LINES),
});


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
  const allowed = await checkRateLimit(`resolve-shared-cart:${ip}`, RATE_LIMITS.sharedCartPerIp);
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
