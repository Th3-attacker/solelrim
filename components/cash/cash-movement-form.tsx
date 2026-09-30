"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { addCashMovement } from "@/lib/actions/cash-sessions";
import { useCashError } from "@/components/cash/use-cash-error";

export function CashMovementForm() {
  const t = useTranslations("cash");
  const router = useRouter();
  const showError = useCashError();
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<"IN" | "OUT">("IN");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const value = Number(amount);
  const valid = amount.trim() !== "" && value > 0 && reason.trim().length >= 3;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    startTransition(async () => {
      const result = await addCashMovement({ type, amount: value, reason });
      if (result.error) return showError(result.error);
      toast.success(t(type === "IN" ? "movementInSaved" : "movementOutSaved"));
      setAmount("");
      setReason("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <ToggleGroup
        type="single"
        variant="outline"
        value={type}
        onValueChange={(next) => next && setType(next as "IN" | "OUT")}
        className="self-start"
      >
        <ToggleGroupItem value="IN">{t("cashIn")}</ToggleGroupItem>
        <ToggleGroupItem value="OUT">{t("cashOut")}</ToggleGroupItem>
      </ToggleGroup>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[10rem_1fr]">
        <div className="flex flex-col gap-2">
          <Label htmlFor="cash-movement-amount">{t("amount")}</Label>
          <Input
            id="cash-movement-amount"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cash-movement-reason">{t("reason")}</Label>
          <Input
            id="cash-movement-reason"
            maxLength={200}
            placeholder={t(type === "IN" ? "reasonInPlaceholder" : "reasonOutPlaceholder")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      </div>
      <Button type="submit" variant="outline" className="self-start" loading={pending} disabled={!valid}>
        {t("addMovement")}
      </Button>
    </form>
  );
}
