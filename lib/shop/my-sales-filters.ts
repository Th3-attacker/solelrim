import { parseBusinessDate } from "@/lib/shop/cash";

export const SALE_STATUSES = ["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED", "CANCELLED"] as const;
type SaleStatusFilter = (typeof SALE_STATUSES)[number];

export type MySalesFilters = {
  // Inclusive UTC calendar days (Mauritania is UTC, see businessDateOf).
  from: Date | null;
  to: Date | null;
  status: SaleStatusFilter | null;
  // "cash", or a wallet provider name (e.g. "Bankily").
  payment: { method: "cash" } | { method: "wallet"; provider: string } | null;
  reference: string | null;
};

type Params = Record<string, string | string[] | undefined>;

function one(params: Params, key: string): string | undefined {
  const value = params[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

// URL → filters. Anything malformed is simply ignored, never trusted.
export function parseMySalesFilters(params: Params): MySalesFilters {
  const from = one(params, "from");
  const to = one(params, "to");
  const status = one(params, "status");
  const payment = one(params, "payment");
  const reference = one(params, "q");
  return {
    from: from ? parseBusinessDate(from) : null,
    to: to ? parseBusinessDate(to) : null,
    status: (SALE_STATUSES as readonly string[]).includes(status ?? "")
      ? (status as SaleStatusFilter)
      : null,
    payment:
      payment === "cash"
        ? { method: "cash" }
        : payment?.startsWith("wallet:") && payment.length > "wallet:".length
          ? { method: "wallet", provider: payment.slice("wallet:".length) }
          : null,
    reference: reference ? reference.slice(0, 60) : null,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

// The seller and boutique come from the caller's own session and are always
// part of the WHERE — the filters can only narrow it further.
export function mySalesWhere(productType: string, sellerId: string, filters: MySalesFilters) {
  return {
    productType,
    sellerId,
    ...(filters.status && { status: filters.status }),
    ...(filters.payment?.method === "cash" && { paymentMethod: "cash" }),
    ...(filters.payment?.method === "wallet" && {
      paymentMethod: "wallet",
      walletProvider: filters.payment.provider,
    }),
    ...(filters.reference && {
      reference: { contains: filters.reference, mode: "insensitive" as const },
    }),
    ...((filters.from || filters.to) && {
      createdAt: {
        ...(filters.from && { gte: filters.from }),
        ...(filters.to && { lt: new Date(filters.to.getTime() + DAY_MS) }),
      },
    }),
  };
}
