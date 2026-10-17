import { Link } from "@tanstack/react-router";
import { cn } from "~/lib/cn";
import { useFormatter, useTranslations } from "use-intl";
import { Status } from "~/components/ui/status";
import type { Locale } from "~/i18n/config";
import { useMoney } from "./till-parts";

type Movement = { id: string; type: "IN" | "OUT"; amount: number; reason: string; createdAt: Date };

export function MovementList({ movements }: { movements: Movement[] }) {
  const t = useTranslations("cash");
  const format = useFormatter();
  const money = useMoney();
  if (movements.length === 0) return <p className="text-[13px] text-muted">{t("noMovements")}</p>;
  return (
    <ul className="flex flex-col">
      {movements.map((movement) => (
        <li
          key={movement.id}
          className="flex items-center justify-between gap-3 border-b border-line-soft py-2 text-[14px] last:border-b-0"
        >
          <span className="min-w-0">
            <span className="block truncate">{movement.reason}</span>
            <time dateTime={movement.createdAt.toISOString()} className="text-[12px] text-muted">
              {format.dateTime(movement.createdAt, { hour: "2-digit", minute: "2-digit" })}
            </time>
          </span>
          <b
            className={
              movement.type === "IN" ? "text-ok-ink tabular-nums" : "text-bad-ink tabular-nums"
            }
          >
            {movement.type === "IN" ? "+" : "−"}
            {money(movement.amount)}
          </b>
        </li>
      ))}
    </ul>
  );
}

type SessionSale = {
  id: string;
  reference: string;
  createdAt: Date;
  total: number;
  status: string;
  paymentMethod: string | null;
  walletProvider: string | null;
};

// The sales rung up on a till, each opening its receipt.
export function SessionSales({ sales, locale }: { sales: SessionSale[]; locale: Locale }) {
  const t = useTranslations("cash");
  const tPos = useTranslations("pos");
  const format = useFormatter();
  const money = useMoney();
  if (sales.length === 0) return <p className="px-5 pb-5 text-[13px] text-muted">{t("noSales")}</p>;
  const cell = "border-b border-line-soft px-4 py-2.5 text-start whitespace-nowrap";
  const head =
    "border-b border-line-soft bg-surface-2 px-4 py-2 text-start text-[12px] font-medium text-muted";
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[14px] tabular-nums">
        <caption className="sr-only">{t("salesTitle")}</caption>
        <thead>
          <tr>
            <th scope="col" className={head}>
              {t("time")}
            </th>
            <th scope="col" className={head}>
              {tPos("reference")}
            </th>
            <th scope="col" className={head}>
              {tPos("paymentMethod")}
            </th>
            <th scope="col" className={cn(head, "text-end")}>
              {tPos("total")}
            </th>
          </tr>
        </thead>
        <tbody>
          {sales.map((sale) => (
            <tr key={sale.id} className="hover:bg-surface-2 [&:last-child>*]:border-b-0">
              <td className={cell}>
                {format.dateTime(sale.createdAt, { hour: "2-digit", minute: "2-digit" })}
              </td>
              <th scope="row" className={cn(cell, "font-semibold")}>
                <Link
                  to="/$locale/admin/pos/receipt/$saleId"
                  params={{ locale, saleId: sale.id }}
                  className="text-ink no-underline hover:text-brand hover:underline"
                >
                  {sale.reference}
                </Link>
                {sale.status === "CANCELLED" && (
                  <Status tone="mute" className="ms-2">
                    {tPos("receiptCancelled")}
                  </Status>
                )}
              </th>
              <td className={cell}>
                {sale.paymentMethod === "cash"
                  ? tPos("cash")
                  : (sale.walletProvider ?? tPos("wallet"))}
              </td>
              <td className={cn(cell, "text-end font-semibold")}>{money(sale.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
