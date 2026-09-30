// Pure till arithmetic, shared by the register actions, the pages and the
// daily closure. Money is handled as MRU numbers rounded to the cent.

// `|| 0` turns a -0 (a shortfall of less than half a cent) into 0.
export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100 || 0;
}

// Mauritania is on UTC all year (no DST), so the boutique's calendar day is
// the UTC day. Returned as UTC midnight, the shape a @db.Date column takes.
export function businessDateOf(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// "YYYY-MM-DD" → UTC midnight, or null for anything that isn't a real date.
export function parseBusinessDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

export function formatBusinessDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export type PaymentGroup = {
  paymentMethod: string | null;
  walletProvider: string | null;
  total: number;
  count: number;
};

export type BreakdownRow = {
  // "other": legacy card/transfer sales, or no method recorded.
  method: "cash" | "wallet" | "other";
  provider: string | null;
  total: number;
  count: number;
};

// Cash first, then every wallet the boutique offers (in its own order, shown
// even at zero so the seller sees each one), then any wallet that has since
// been removed, then everything else.
export function buildPaymentBreakdown(
  groups: PaymentGroup[],
  walletProviders: string[],
): BreakdownRow[] {
  const cash: BreakdownRow = { method: "cash", provider: null, total: 0, count: 0 };
  const wallets = new Map<string | null, BreakdownRow>(
    walletProviders.map((provider) => [
      provider,
      { method: "wallet", provider, total: 0, count: 0 },
    ]),
  );
  const other: BreakdownRow = { method: "other", provider: null, total: 0, count: 0 };

  for (const group of groups) {
    let row: BreakdownRow;
    if (group.paymentMethod === "cash") {
      row = cash;
    } else if (group.paymentMethod === "wallet") {
      const existing = wallets.get(group.walletProvider);
      row = existing ?? { method: "wallet", provider: group.walletProvider, total: 0, count: 0 };
      if (!existing) wallets.set(group.walletProvider, row);
    } else {
      row = other;
    }
    row.total = roundMoney(row.total + group.total);
    row.count += group.count;
  }

  return [cash, ...wallets.values(), ...(other.count > 0 ? [other] : [])];
}

export type SessionTotals = {
  openingFloat: number;
  breakdown: BreakdownRow[];
  salesTotal: number;
  salesCount: number;
  cashIn: number;
  cashOut: number;
  // Opening float + cash sales + money in − money out.
  expectedCash: number;
};

export function computeSessionTotals(input: {
  openingFloat: number;
  groups: PaymentGroup[];
  walletProviders: string[];
  cashIn: number;
  cashOut: number;
}): SessionTotals {
  const breakdown = buildPaymentBreakdown(input.groups, input.walletProviders);
  const cashSales = breakdown[0].total;
  return {
    openingFloat: input.openingFloat,
    breakdown,
    salesTotal: roundMoney(breakdown.reduce((sum, row) => sum + row.total, 0)),
    salesCount: breakdown.reduce((sum, row) => sum + row.count, 0),
    cashIn: input.cashIn,
    cashOut: input.cashOut,
    expectedCash: roundMoney(input.openingFloat + cashSales + input.cashIn - input.cashOut),
  };
}

// A whole business day as one till: floats, sales and movements summed,
// breakdown rows merged by method and wallet in first-seen order.
export function combineSessionTotals(list: SessionTotals[]): SessionTotals {
  const rows = new Map<string, BreakdownRow>();
  for (const totals of list) {
    for (const row of totals.breakdown) {
      const key = `${row.method}:${row.provider ?? ""}`;
      const merged = rows.get(key) ?? { ...row, total: 0, count: 0 };
      merged.total = roundMoney(merged.total + row.total);
      merged.count += row.count;
      rows.set(key, merged);
    }
  }
  const sum = (pick: (totals: SessionTotals) => number) =>
    roundMoney(list.reduce((total, totals) => total + pick(totals), 0));
  return {
    openingFloat: sum((t) => t.openingFloat),
    breakdown: [...rows.values()],
    salesTotal: sum((t) => t.salesTotal),
    salesCount: list.reduce((count, totals) => count + totals.salesCount, 0),
    cashIn: sum((t) => t.cashIn),
    cashOut: sum((t) => t.cashOut),
    expectedCash: sum((t) => t.expectedCash),
  };
}

// Positive = more cash than expected (excess), negative = shortfall.
export function cashDifference(countedCash: number, expectedCash: number): number {
  return roundMoney(countedCash - expectedCash);
}
