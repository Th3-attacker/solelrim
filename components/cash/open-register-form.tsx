"use client";

import { useState, useTransition } from "react";
import { CashRegister } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { openCashSession } from "@/lib/actions/cash-sessions";
import { useCashError } from "@/components/cash/use-cash-error";

// Shown instead of the checkout until the caller opens their own till.
export function OpenRegisterForm() {
  const t = useTranslations("cash");
  const router = useRouter();
  const showError = useCashError();
  const [pending, startTransition] = useTransition();
  const [openingFloat, setOpeningFloat] = useState("");

  const value = openingFloat.trim() === "" ? null : Number(openingFloat);
  const valid = value !== null && Number.isFinite(value) && value >= 0;

  function handleOpen(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    startTransition(async () => {
      const result = await openCashSession({ openingFloat: value });
      // alreadyOpen: another tab opened it — refreshing shows the checkout.
      if (result.error && result.error !== "alreadyOpen") return showError(result.error);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleOpen}
      className="mx-auto flex w-full max-w-sm flex-col gap-4 rounded-md border p-6"
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <CashRegister aria-hidden="true" className="size-10 text-primary" />
        <h1 className="text-xl font-semibold tracking-tight">{t("openTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("openHint")}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="cash-opening-float">{t("openingFloat")}</Label>
        <Input
          id="cash-opening-float"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          autoFocus
          value={openingFloat}
          onChange={(e) => setOpeningFloat(e.target.value)}
        />
      </div>
      <Button type="submit" loading={pending} disabled={!valid}>
        {t("openAction")}
      </Button>
    </form>
  );
}
