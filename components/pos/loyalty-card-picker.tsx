"use client";

import { useState, useTransition } from "react";
import { IdentificationCard, X } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { enrollLoyaltyCard, lookupLoyaltyCard, type LoyaltyCard } from "@/lib/actions/loyalty";
import { formatPrice } from "@/lib/format/currency";
import type { PosLoyaltyRule } from "@/lib/queries/pos";

const KNOWN_ERRORS = new Set(["invalidPhone", "disabled", "unauthorized", "licenseBlocked"]);

// Entirely optional: a sale goes through without ever touching this. The
// seller looks a card up by the customer's number; if there's none, they
// can enroll the customer — only once the customer agrees.
export function LoyaltyCardPicker({
  rule,
  card,
  redeem,
  onCardChange,
  onRedeemChange,
}: {
  rule: PosLoyaltyRule;
  card: LoyaltyCard | null;
  redeem: boolean;
  onCardChange: (card: LoyaltyCard | null) => void;
  onRedeemChange: (redeem: boolean) => void;
}) {
  const t = useTranslations("pos");
  const tCommon = useTranslations("common");
  const [pending, startTransition] = useTransition();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  // The number just looked up that has no card yet — offers enrollment.
  const [notFoundPhone, setNotFoundPhone] = useState<string | null>(null);

  function showError(error: string) {
    toast.error(KNOWN_ERRORS.has(error) ? t(`loyaltyError.${error}`) : tCommon("error"));
  }

  function handleLookup() {
    startTransition(async () => {
      const result = await lookupLoyaltyCard(phone);
      if (result.error) return showError(result.error);
      if (result.card) {
        onCardChange(result.card);
        setNotFoundPhone(null);
      } else {
        setNotFoundPhone(phone);
      }
    });
  }

  function handleEnroll() {
    startTransition(async () => {
      const result = await enrollLoyaltyCard({ phone: notFoundPhone ?? phone, name });
      if (result.error) return showError(result.error);
      if (result.card) {
        onCardChange(result.card);
        setNotFoundPhone(null);
        setName("");
        toast.success(t("loyaltyEnrolled"));
      }
    });
  }

  function handleDetach() {
    onCardChange(null);
    onRedeemChange(false);
    setPhone("");
    setNotFoundPhone(null);
  }

  if (card) {
    const canRedeem = card.points >= rule.rewardPoints;
    return (
      <div className="flex flex-col gap-2 rounded-md border p-3">
        <div className="flex items-start gap-2">
          <IdentificationCard aria-hidden="true" className="mt-0.5 size-5 text-primary" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">{card.name}</span>
            <span dir="ltr" className="text-xs text-muted-foreground">
              {card.phone}
            </span>
            <span className="text-xs font-medium tabular-nums">
              {t("loyaltyBalance", { points: card.points })}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleDetach}
            aria-label={t("loyaltyDetach")}
          >
            <X className="size-4" />
          </Button>
        </div>
        {canRedeem ? (
          <div className="flex items-start gap-2">
            <Checkbox
              id="pos-loyalty-redeem"
              checked={redeem}
              onCheckedChange={(checked) => onRedeemChange(checked === true)}
            />
            <Label htmlFor="pos-loyalty-redeem" className="font-normal">
              {t("loyaltyRedeem", {
                value: formatPrice(rule.rewardValue, tCommon("currency")),
                points: rule.rewardPoints,
              })}
            </Label>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t("loyaltyNotEnough", { points: rule.rewardPoints - card.points })}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="pos-loyalty-phone">{t("loyaltyCard")}</Label>
      <div className="flex gap-2">
        <Input
          id="pos-loyalty-phone"
          type="tel"
          inputMode="tel"
          dir="ltr"
          autoComplete="off"
          placeholder="22 12 34 56"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            setNotFoundPhone(null);
          }}
        />
        <Button
          type="button"
          variant="outline"
          loading={pending && notFoundPhone === null}
          disabled={!phone.trim()}
          onClick={handleLookup}
        >
          {t("loyaltyLookup")}
        </Button>
      </div>
      {notFoundPhone !== null && (
        <div className="flex flex-col gap-2 rounded-md border border-dashed p-3">
          <p className="text-sm">{t("loyaltyNotFound")}</p>
          <Label htmlFor="pos-loyalty-name" className="text-xs font-normal text-muted-foreground">
            {t("loyaltyName")}
          </Label>
          <Input
            id="pos-loyalty-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
          <Button type="button" variant="outline" loading={pending} onClick={handleEnroll}>
            {t("loyaltyEnroll")}
          </Button>
        </div>
      )}
    </div>
  );
}
