"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { closeCashSession } from "@/lib/actions/cash-sessions";
import { cashDifference } from "@/lib/shop/cash";
import { formatPrice } from "@/lib/format/currency";
import { useCashError } from "@/components/cash/use-cash-error";
import { StatusAlert, FieldError } from "@/components/ui/status-alert";

// The difference shown here is a preview; the server recomputes the
// expected cash inside the closing transaction and records its own figure.
export function CloseSessionForm({
  sessionId,
  expectedCash,
  redirectTo,
}: {
  sessionId: string;
  expectedCash: number;
  redirectTo?: string;
}) {
  const t = useTranslations("cash");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const showError = useCashError();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");

  const countedValue = counted.trim() === "" ? null : Number(counted);
  const difference =
    countedValue !== null && Number.isFinite(countedValue)
      ? cashDifference(countedValue, expectedCash)
      : null;
  const noteMissing = difference !== null && difference !== 0 && !note.trim();
  const valid = countedValue !== null && countedValue >= 0 && !noteMissing;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (valid) setConfirmOpen(true);
  }

  async function handleClose() {
    const result = await closeCashSession({ sessionId, countedCash: countedValue, note });
    if (result.error) return showError(result.error);
    toast.success(t("closed"));
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  }

  const money = (amount: number) => formatPrice(amount, tCommon("currency"));

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="cash-counted">{t("countedCash")}</Label>
        <Input
          id="cash-counted"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={counted}
          onChange={(e) => setCounted(e.target.value)}
        />
      </div>
      {difference !== null && (
        <StatusAlert variant={difference === 0 ? "success" : difference < 0 ? "error" : "warning"}>
          {difference === 0
            ? t("differenceNone")
            : t(difference < 0 ? "differenceShort" : "differenceOver", {
                amount: money(Math.abs(difference)),
              })}
        </StatusAlert>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="cash-close-note">
          {t("closingNote")}
          {difference !== null && difference !== 0 ? " *" : ""}
        </Label>
        <Textarea
          id="cash-close-note"
          maxLength={500}
          value={note}
          aria-invalid={noteMissing}
          onChange={(e) => setNote(e.target.value)}
        />
        {noteMissing && <FieldError>{t("noteRequiredHint")}</FieldError>}
      </div>
      <Button type="submit" variant="destructive" className="self-start" disabled={!valid}>
        {t("closeAction")}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("closeConfirmTitle")}
        description={t("closeConfirmBody", {
          counted: money(countedValue ?? 0),
          difference:
            difference === null || difference === 0
              ? t("differenceNone")
              : t(difference < 0 ? "differenceShort" : "differenceOver", {
                  amount: money(Math.abs(difference)),
                }),
        })}
        confirmLabel={t("closeAction")}
        destructive
        onConfirm={handleClose}
      />
    </form>
  );
}
