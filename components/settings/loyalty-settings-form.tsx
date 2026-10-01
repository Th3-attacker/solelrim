"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateLoyaltySettings } from "@/lib/actions/loyalty";
import { formatPrice } from "@/lib/format/currency";

type LoyaltyRule = {
  enabled: boolean;
  spendPerPoint: number;
  rewardPoints: number;
  rewardValue: number;
};

const FIELDS = ["spendPerPoint", "rewardPoints", "rewardValue"] as const;
type NumericField = (typeof FIELDS)[number];

export function LoyaltySettingsForm({ rule }: { rule: LoyaltyRule }) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(rule.enabled);
  const [values, setValues] = useState<Record<NumericField, string>>({
    spendPerPoint: String(rule.spendPerPoint),
    rewardPoints: String(rule.rewardPoints),
    rewardValue: String(rule.rewardValue),
  });

  // Whole positive numbers only — an empty field must never be sent as 0.
  const isValid = FIELDS.every((field) => /^[1-9]\d*$/.test(values[field].trim()));

  function handleSave() {
    startTransition(async () => {
      const result = await updateLoyaltySettings({
        enabled,
        spendPerPoint: Number(values.spendPerPoint),
        rewardPoints: Number(values.rewardPoints),
        rewardValue: Number(values.rewardValue),
      });
      if (result.error) {
        toast.error(tCommon("error"));
        return;
      }
      toast.success(tCommon("save"));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium">{t("loyaltySection")}</span>
      <p className="text-sm text-muted-foreground">{t("loyaltyHint")}</p>

      <div className="flex items-center gap-2">
        <Checkbox
          id="loyalty-enabled"
          checked={enabled}
          onCheckedChange={(checked) => setEnabled(checked === true)}
        />
        <Label htmlFor="loyalty-enabled" className="font-normal">
          {t("loyaltyEnabled")}
        </Label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {FIELDS.map((field) => (
          <div key={field} className="flex flex-col gap-2">
            <Label htmlFor={`loyalty-${field}`}>{t(`loyalty_${field}`)}</Label>
            <Input
              id={`loyalty-${field}`}
              type="number"
              inputMode="numeric"
              min={1}
              disabled={!enabled}
              value={values[field]}
              aria-invalid={!/^[1-9]\d*$/.test(values[field].trim())}
              onChange={(e) => setValues((prev) => ({ ...prev, [field]: e.target.value }))}
            />
          </div>
        ))}
      </div>

      {isValid && enabled && (
        <p className="text-xs text-muted-foreground">
          {t("loyaltyPreview", {
            spend: formatPrice(Number(values.spendPerPoint), tCommon("currency")),
            points: Number(values.rewardPoints),
            value: formatPrice(Number(values.rewardValue), tCommon("currency")),
          })}
        </p>
      )}

      <Button
        type="button"
        variant="outline"
        className="self-start"
        loading={pending}
        disabled={!isValid}
        onClick={handleSave}
      >
        {tCommon("save")}
      </Button>
    </div>
  );
}
