import type { Decimal } from "@/lib/generated/prisma/internal/prismaNamespace";

export function isNewProduct(createdAt: Date, windowDays = 30): boolean {
  return Date.now() - createdAt.getTime() < windowDays * 24 * 60 * 60 * 1000;
}

export function isPromo(
  compareAtPrice: Decimal | null,
  effectivePrice: number,
): boolean {
  return compareAtPrice != null && compareAtPrice.toNumber() > effectivePrice;
}
