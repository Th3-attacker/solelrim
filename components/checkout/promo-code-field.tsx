"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/status-alert";
import { previewPromoCode } from "@/lib/actions/promo-codes";
import type { PromoDiscountType } from "@/lib/generated/prisma/enums";

export type AppliedPromo = {
  code: string;
  discountType: PromoDiscountType;
  discountValue: number;
};

// Why a code was refused, in the customer's words: the preview here and
// submitOrder's re-check (CheckoutFlow) answer with the same codes.
export function usePromoCodeErrorMessage() {
  const t = useTranslations("checkout");
  return (code: string) => {
    switch (code) {
      case "expired":
        return t("promoCodeExpiredError");
      case "usageLimitReached":
        return t("promoCodeUsageLimitError");
      case "notYours":
        return t("promoCodeNotYoursError");
      case "alreadyUsed":
        return t("promoCodeAlreadyUsedError");
      default:
        return t("promoCodeInvalidError");
    }
  };
}

// Step 2's optional promo code: previewed against the server, never trusted
// by it (submitOrder checks the code again when the order is placed).
export function PromoCodeField({
  storeType,
  customerPhone,
  subtotal,
  applied,
  onApply,
  onRemove,
}: {
  storeType: string;
  customerPhone: string;
  subtotal: number;
  applied: AppliedPromo | null;
  onApply: (promo: AppliedPromo) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("checkout");
  const tCommon = useTranslations("common");
  const errorMessage = usePromoCodeErrorMessage();
  const [input, setInput] = useState("");
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApply() {
    if (!input.trim()) return;
    setApplying(true);
    setError(null);
    try {
      const result = await previewPromoCode({
        code: input,
        productType: storeType,
        customerPhone,
        subtotal,
      });
      if ("error" in result) {
        setError(errorMessage(result.error));
        return;
      }
      onApply({
        code: input.trim().toUpperCase(),
        discountType: result.discountType,
        discountValue: result.discountValue,
      });
    } catch {
      // No answer (connection lost): the button comes back.
      setError(tCommon("error"));
    } finally {
      setApplying(false);
    }
  }

  function handleRemove() {
    setInput("");
    setError(null);
    onRemove();
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="promoCode">{t("promoCode")}</Label>
      {applied ? (
        <div className="flex items-center justify-between rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
          <span className="font-mono font-medium">{applied.code}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleRemove}
            aria-label={t("removePromoCode")}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            id="promoCode"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(null);
            }}
            placeholder={t("promoCodePlaceholder")}
            autoComplete="off"
            aria-invalid={!!error}
            aria-describedby={error ? "promoCode-error" : undefined}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            loading={applying}
            disabled={!input.trim()}
            onClick={handleApply}
          >
            {t("applyPromoCode")}
          </Button>
        </div>
      )}
      {error && <FieldError id="promoCode-error">{error}</FieldError>}
    </div>
  );
}
