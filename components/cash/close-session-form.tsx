"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { closeCashSession } from "@/lib/actions/cash-sessions";
import { cashDifference } from "@/lib/shop/cash";
import { formatPrice } from "@/lib/format/currency";
import { useCashError } from "@/components/cash/use-cash-error";

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
  const [pending, startTransition] = useTransition();
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
    if (!valid) return;
    startTransition(async () => {
      const result = await closeCashSession({ sessionId, countedCash: countedValue, note });
      if (result.error) return showError(result.error);
      toast.success(t("closed"));
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    });
  }

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
        <p
          className={
            difference === 0
              ? "text-sm text-muted-foreground"
              : "text-sm font-medium text-destructive"
          }
        >
          {difference === 0
            ? t("differenceNone")
            : t(difference < 0 ? "differenceShort" : "differenceOver", {
                amount: formatPrice(Math.abs(difference), tCommon("currency")),
              })}
        </p>
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
        {noteMissing && <p className="text-xs text-destructive">{t("noteRequiredHint")}</p>}
      </div>
      <Button type="submit" variant="destructive" className="self-start" loading={pending} disabled={!valid}>
        {t("closeAction")}
      </Button>
    </form>
  );
}
