"use client";

import { useTranslations } from "next-intl";
import { RefundRequestDialog, type RefundableLine } from "@/components/refunds/refund-request-dialog";
import { RefundRequestList, type RefundRequestView } from "@/components/refunds/refund-request-list";

// On a sale's page: ask for a refund, and follow (or, for an admin, decide)
// the sale's requests.
export function SaleRefundsSection({
  saleId,
  refundable,
  hasPending,
  subtotal,
  total,
  refundedAmount,
  lines,
  requests,
  canDecide,
}: {
  saleId: string;
  refundable: boolean;
  hasPending: boolean;
  subtotal: number;
  total: number;
  refundedAmount: number;
  lines: RefundableLine[];
  requests: RefundRequestView[];
  canDecide: boolean;
}) {
  const t = useTranslations("refunds");
  if (!refundable && requests.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">{t("title")}</h2>
        {refundable && !hasPending && (
          <RefundRequestDialog
            saleId={saleId}
            lines={lines}
            subtotal={subtotal}
            total={total}
            refundedAmount={refundedAmount}
          />
        )}
      </div>
      {hasPending && !canDecide && <p className="text-sm text-muted-foreground">{t("pendingHint")}</p>}
      {requests.length > 0 && <RefundRequestList requests={requests} canDecide={canDecide} />}
    </section>
  );
}
