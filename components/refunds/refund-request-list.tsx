"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/format/currency";
import { RefundDecision } from "@/components/refunds/refund-decision";

export type RefundRequestView = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reason: string;
  requestedByEmail: string;
  createdAt: Date;
  decidedByEmail: string | null;
  decidedAt: Date | null;
  rejectionReason: string | null;
  amount: number | null;
  paymentMethod: string | null;
  walletProvider: string | null;
  items: { name: string; size: string; color: string; quantity: number }[];
  // Set when listed across sales (the refunds page).
  saleId?: string;
  saleReference?: string;
  salePaymentMethod?: string | null;
  saleWalletProvider?: string | null;
};

const STATUS_VARIANT = {
  PENDING: "default",
  APPROVED: "secondary",
  REJECTED: "destructive",
} as const;

export function RefundRequestList({
  requests,
  canDecide,
  // Where a sale reference links to (sellers can't open /admin/sales).
  saleHref = (saleId: string) => `/admin/pos/receipt/${saleId}`,
}: {
  requests: RefundRequestView[];
  canDecide: boolean;
  saleHref?: (saleId: string) => string;
}) {
  const t = useTranslations("refunds");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const money = (amount: number) => formatPrice(amount, tCommon("currency"));
  const date = (value: Date) =>
    format.dateTime(value, { dateStyle: "medium", timeStyle: "short" });

  return (
    <ul className="flex flex-col gap-3">
      {requests.map((request) => (
        <li
          key={request.id}
          className="flex flex-col gap-2 rounded-md border p-3 text-sm sm:p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {request.saleId && request.saleReference && (
                <Link
                  href={saleHref(request.saleId)}
                  className="font-medium hover:underline"
                >
                  {request.saleReference}
                </Link>
              )}
              <Badge variant={STATUS_VARIANT[request.status]}>
                {t(`status.${request.status}`)}
              </Badge>
            </div>
            <span dir="ltr" className="font-semibold tabular-nums">
              {request.amount === null
                ? "—"
                : request.status === "PENDING"
                  ? `≈ ${money(request.amount)}`
                  : money(request.amount)}
            </span>
          </div>
          <ul className="flex flex-col">
            {request.items.map((item, index) => (
              <li key={index} className="flex justify-between gap-2">
                <span className="min-w-0 truncate">
                  {item.name}{" "}
                  <span className="text-muted-foreground">
                    · {item.size} · {item.color}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums">× {item.quantity}</span>
              </li>
            ))}
          </ul>
          <p>
            <span className="text-muted-foreground">{t("reason")}:</span>{" "}
            {request.reason}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("requestedBy", {
              email: request.requestedByEmail,
              date: date(request.createdAt),
            })}
          </p>
          {request.decidedAt && request.decidedByEmail && (
            <p className="text-xs text-muted-foreground">
              {t(request.status === "APPROVED" ? "approvedBy" : "rejectedBy", {
                email: request.decidedByEmail,
                date: date(request.decidedAt),
              })}
              {request.rejectionReason && ` — ${request.rejectionReason}`}
            </p>
          )}
          {canDecide && request.status === "PENDING" && (
            <RefundDecision
              requestId={request.id}
              amount={request.amount}
              paymentMethod={request.salePaymentMethod ?? request.paymentMethod}
              walletProvider={
                request.saleWalletProvider ?? request.walletProvider
              }
            />
          )}
        </li>
      ))}
    </ul>
  );
}
