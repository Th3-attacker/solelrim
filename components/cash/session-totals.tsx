"use client";

import { useTranslations } from "next-intl";
import { formatPrice } from "@/lib/format/currency";
import type { BreakdownRow, SessionTotals } from "@/lib/shop/cash";

// A till's figures: float, takings per payment method (cash, then each
// wallet), grand total, movements, and the cash that should be in the
// drawer. Also used for a whole consolidated day.
export function SessionTotalsView({ totals }: { totals: SessionTotals }) {
  const t = useTranslations("cash");
  const tCommon = useTranslations("common");
  const money = (amount: number) => formatPrice(amount, tCommon("currency"));

  function methodLabel(row: BreakdownRow) {
    if (row.method === "cash") return t("methodCash");
    if (row.method === "wallet") return row.provider ?? t("methodWallet");
    return t("methodOther");
  }

  return (
    <dl className="flex flex-col gap-1 text-sm tabular-nums">
      <Row label={t("openingFloat")} value={money(totals.openingFloat)} />
      <div className="my-1 border-t border-dashed" />
      {totals.breakdown.map((row) => (
        <Row
          key={`${row.method}:${row.provider ?? ""}`}
          label={`${methodLabel(row)} (${row.count})`}
          value={money(row.total)}
          muted={row.count === 0}
        />
      ))}
      <Row label={t("salesTotal")} value={money(totals.salesTotal)} strong />
      <div className="my-1 border-t border-dashed" />
      <Row label={t("cashIn")} value={`+${money(totals.cashIn)}`} />
      <Row label={t("cashOut")} value={`-${money(totals.cashOut)}`} />
      {(totals.cashRefunds ?? 0) > 0 && (
        <Row label={t("cashRefunds")} value={`-${money(totals.cashRefunds ?? 0)}`} />
      )}
      <Row label={t("expectedCash")} value={money(totals.expectedCash)} strong />
    </dl>
  );
}

function Row({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={
        strong
          ? "flex justify-between gap-2 font-semibold"
          : muted
            ? "flex justify-between gap-2 text-muted-foreground"
            : "flex justify-between gap-2"
      }
    >
      <dt>{label}</dt>
      <dd dir="ltr">{value}</dd>
    </div>
  );
}
