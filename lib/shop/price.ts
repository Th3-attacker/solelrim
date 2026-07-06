import type { Decimal } from "@/lib/generated/prisma/internal/prismaNamespace";

type PricedVariant = { price: Decimal | null };

export function getVariantPrice(variant: PricedVariant, basePrice: Decimal): number {
  return (variant.price ?? basePrice).toNumber();
}

export function getPriceRange(variants: PricedVariant[], basePrice: Decimal) {
  const prices = variants.map((v) => getVariantPrice(v, basePrice));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return { min, max, isRange: min !== max };
}
