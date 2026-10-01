"use client";

import { useState, useTransition } from "react";
import { ArrowCounterClockwise } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { requestRefund } from "@/lib/actions/refunds";
import { computeRefund } from "@/lib/shop/refund";
import { formatPrice } from "@/lib/format/currency";
import { useRefundError } from "@/components/refunds/use-refund-error";

export type RefundableLine = {
  saleItemId: string;
  name: string;
  size: string;
  color: string;
  unitPrice: number;
  quantity: number;
  refundedQuantity: number;
};

// Whole sale in one tap, or chosen units per line. The amount shown is an
// estimate; the server recomputes it when the admin approves.
export function RefundRequestDialog({
  saleId,
  lines,
  subtotal,
  total,
  refundedAmount,
}: {
  saleId: string;
  lines: RefundableLine[];
  subtotal: number;
  total: number;
  refundedAmount: number;
}) {
  const t = useTranslations("refunds");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const showError = useRefundError();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");

  const remaining = (line: RefundableLine) =>
    line.quantity - line.refundedQuantity;
  const refundableLines = lines.filter((line) => remaining(line) > 0);
  const qty = (id: string) => {
    const value = Number(quantities[id] ?? "0");
    return Number.isInteger(value) ? value : NaN;
  };

  const estimate = computeRefund({
    subtotal,
    total,
    refundedAmount,
    loyaltyPointsEarned: 0,
    loyaltyPointsRedeemed: 0,
    previousPointsTakenBack: 0,
    previousPointsReturned: 0,
    lines: lines.map((line) => ({
      saleItemId: line.saleItemId,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      refundedQuantity: line.refundedQuantity,
      refundQuantity: qty(line.saleItemId) || 0,
    })),
  });
  const valid =
    estimate !== null &&
    reason.trim().length >= 3 &&
    lines.every((line) => !Number.isNaN(qty(line.saleItemId)));

  function selectAll() {
    setQuantities(
      Object.fromEntries(
        refundableLines.map((line) => [
          line.saleItemId,
          String(remaining(line)),
        ]),
      ),
    );
  }

  function handleSubmit() {
    if (!valid) return;
    startTransition(async () => {
      const result = await requestRefund({
        saleId,
        items: lines
          .filter((line) => qty(line.saleItemId) > 0)
          .map((line) => ({
            saleItemId: line.saleItemId,
            quantity: qty(line.saleItemId),
          })),
        reason,
      });
      if (result.error) return showError(result.error);
      toast.success(t("requested"));
      setOpen(false);
      setQuantities({});
      setReason("");
      router.refresh();
    });
  }

  if (refundableLines.length === 0) return null;

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button type="button" variant="outline">
          <ArrowCounterClockwise className="size-4" />
          {t("requestAction")}
        </Button>
      }
      title={t("requestTitle")}
      description={t("requestHint")}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            loading={pending}
            disabled={!valid}
            onClick={handleSubmit}
          >
            {t("requestSubmit")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={selectAll}
        >
          {t("wholeSale")}
        </Button>
        <ul className="flex flex-col gap-3">
          {refundableLines.map((line) => (
            <li
              key={line.saleItemId}
              className="flex items-center justify-between gap-3"
            >
              <div className="flex min-w-0 flex-col text-sm">
                <span className="truncate font-medium">{line.name}</span>
                <span className="text-xs text-muted-foreground">
                  {line.size} · {line.color} ·{" "}
                  {t("refundableOf", { count: remaining(line) })}
                </span>
              </div>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={remaining(line)}
                step={1}
                className="w-20 shrink-0"
                aria-label={t("quantityFor", { name: line.name })}
                value={quantities[line.saleItemId] ?? ""}
                placeholder="0"
                onChange={(e) =>
                  setQuantities((prev) => ({
                    ...prev,
                    [line.saleItemId]: e.target.value,
                  }))
                }
              />
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2">
          <Label htmlFor="refund-reason">{t("reason")}</Label>
          <Textarea
            id="refund-reason"
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <p className="text-sm">
          {estimate
            ? t("estimate", {
                amount: formatPrice(estimate.amount, tCommon("currency")),
              })
            : t("pickUnits")}
        </p>
      </div>
    </ResponsiveFormDialog>
  );
}
