"use server";

import { prisma } from "@/lib/prisma";

// The cart persists in localStorage with a stock snapshot taken at
// add-to-cart time, which can go stale (another sale, an admin adjusting
// stock, or the visitor just coming back days later). Public and
// unauthenticated by design — this only ever reveals a stock count for
// variants the caller already knows the id of, same as the storefront
// itself already shows.
export async function getVariantStocks(
  productType: string,
  variantIds: string[],
): Promise<Record<string, number>> {
  if (variantIds.length === 0) return {};

  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds }, product: { productType } },
    select: { id: true, stock: true },
  });

  return Object.fromEntries(variants.map((v) => [v.id, v.stock]));
}
