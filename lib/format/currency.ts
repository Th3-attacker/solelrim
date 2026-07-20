import type { Decimal } from "@/lib/generated/prisma/internal/prismaNamespace";

type PriceValue = number | Decimal;

function toNumber(value: PriceValue): number {
  return typeof value === "number" ? value : value.toNumber();
}

// MRU is used without decimal subunits in everyday commerce, and amounts
// are conventionally grouped with "." (e.g. 2.000 = deux mille), not the
// comma/space grouping next-intl's locale formatting would otherwise pick.
// The currency label itself varies by language (e.g. "أوقية" in Arabic), so
// callers pass it in — see the `common.currency` translation key.
export function formatPriceNumber(value: PriceValue): string {
  return Math.round(toNumber(value))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function formatPrice(value: PriceValue, currency: string): string {
  return `${formatPriceNumber(value)} ${currency}`;
}
