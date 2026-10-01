"use client";

import type { ReactNode } from "react";
import { Minus, Plus, Trash } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatPrice } from "@/lib/format/currency";
import { getSwatchStyle } from "@/lib/shop/color-swatch";
import { cn } from "@/lib/utils";
import type { PosWallet } from "@/lib/queries/pos";
import { FieldError } from "@/components/ui/status-alert";

// Derived by CheckoutScreen from the *current* catalog on every render, so
// price and stock are never a stale snapshot from when the item was added.
export type CartLine = {
  variantId: string;
  productName: string;
  size: string;
  color: string;
  unitPrice: number;
  quantity: number;
  stock: number;
  // Sold out since it was added — excluded from the total and the sale
  // until the seller removes it.
  unavailable: boolean;
};

export type PaymentMethod = "cash" | "wallet";

// Purely controlled: all cart and payment state lives in CheckoutScreen, so
// this panel can move between the desktop side column and the mobile sheet
// without two copies of the state drifting apart.
export function CartPanel({
  cart,
  wallets,
  subtotal,
  discountValue,
  loyaltyDiscountValue,
  pointsPreview,
  loyaltySlot,
  total,
  discount,
  onDiscountChange,
  paymentMethod,
  onPaymentMethodChange,
  amountReceived,
  onAmountReceivedChange,
  walletAccountId,
  onWalletAccountChange,
  onQuantityChange,
  onRemove,
  canCharge,
  pending,
  onCharge,
}: {
  cart: CartLine[];
  wallets: PosWallet[];
  subtotal: number;
  discountValue: number;
  loyaltyDiscountValue: number;
  // Points this sale would earn on the attached card; null without a card.
  pointsPreview: number | null;
  // The loyalty card picker, or nothing when the boutique has loyalty off.
  loyaltySlot?: ReactNode;
  total: number;
  discount: string;
  onDiscountChange: (value: string) => void;
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (value: PaymentMethod) => void;
  amountReceived: string;
  onAmountReceivedChange: (value: string) => void;
  walletAccountId: string | null;
  onWalletAccountChange: (id: string) => void;
  onQuantityChange: (variantId: string, quantity: number) => void;
  onRemove: (variantId: string) => void;
  canCharge: boolean;
  pending: boolean;
  onCharge: () => void;
}) {
  const t = useTranslations("pos");
  const tCommon = useTranslations("common");
  const currency = tCommon("currency");

  const received = amountReceived.trim() ? Number(amountReceived) : null;
  // Rounded up for display: prices can carry cents while MRU amounts are
  // shown whole, and "0 MRU short" next to a disabled Charge button would
  // leave the seller guessing.
  const shortBy =
    received !== null && received < total ? Math.max(Math.ceil(total - received), 1) : 0;
  const change = received !== null && received >= total ? received - total : null;
  const hasSellableLine = cart.some((line) => !line.unavailable);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold">{t("cart")}</h2>

      {cart.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          {t("emptyCart")}
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-md border bg-card">
          {cart.map((line) => (
            <li
              key={line.variantId}
              className={cn("flex flex-col gap-2 p-3", line.unavailable && "bg-destructive/5")}
            >
              <div className="flex items-start gap-2">
                <span
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 rounded-full border"
                  style={getSwatchStyle(line.color)}
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{line.productName}</span>
                  <span className="text-xs text-muted-foreground">
                    {line.size} · {line.color} · {formatPrice(line.unitPrice, currency)}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onRemove(line.variantId)}
                  aria-label={t("remove")}
                >
                  <Trash className="size-4" />
                </Button>
              </div>
              {line.unavailable ? (
                <p className="text-xs font-medium text-destructive">{t("lineSoldOut")}</p>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      disabled={line.quantity <= 1}
                      onClick={() => onQuantityChange(line.variantId, line.quantity - 1)}
                      aria-label={t("decrease")}
                    >
                      <Minus className="size-4" />
                    </Button>
                    <span className="w-8 text-center text-sm font-medium tabular-nums">
                      {line.quantity}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      disabled={line.quantity >= line.stock}
                      onClick={() => onQuantityChange(line.variantId, line.quantity + 1)}
                      aria-label={t("increase")}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatPrice(line.unitPrice * line.quantity, currency)}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {loyaltySlot}

      <div className="flex flex-col gap-2">
        <Label htmlFor="pos-discount">{t("discount")}</Label>
        <Input
          id="pos-discount"
          type="number"
          inputMode="decimal"
          min={0}
          value={discount}
          onChange={(e) => onDiscountChange(e.target.value)}
          placeholder="0"
        />
      </div>

      <dl className="flex flex-col gap-1 text-sm tabular-nums">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">{t("subtotal")}</dt>
          <dd>{formatPrice(subtotal, currency)}</dd>
        </div>
        {discountValue > 0 && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t("discount")}</dt>
            <dd>−{formatPrice(discountValue, currency)}</dd>
          </div>
        )}
        {loyaltyDiscountValue > 0 && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t("loyaltyReward")}</dt>
            <dd>−{formatPrice(loyaltyDiscountValue, currency)}</dd>
          </div>
        )}
        <div className="flex justify-between border-t pt-2 text-lg font-semibold">
          <dt>{t("total")}</dt>
          <dd>{formatPrice(total, currency)}</dd>
        </div>
        {pointsPreview !== null && pointsPreview > 0 && (
          <p className="text-end text-xs text-primary">
            {t("loyaltyWillEarn", { points: pointsPreview })}
          </p>
        )}
      </dl>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("paymentMethod")}</span>
        <ToggleGroup
          type="single"
          variant="outline"
          spacing={0}
          className="w-full"
          value={paymentMethod}
          onValueChange={(value) => value && onPaymentMethodChange(value as PaymentMethod)}
        >
          <ToggleGroupItem value="cash" className="flex-1">
            {t("cash")}
          </ToggleGroupItem>
          <ToggleGroupItem value="wallet" className="flex-1" disabled={wallets.length === 0}>
            {t("wallet")}
          </ToggleGroupItem>
        </ToggleGroup>
        {wallets.length === 0 && (
          <p className="text-xs text-muted-foreground">{t("noWallets")}</p>
        )}
      </div>

      {paymentMethod === "cash" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="pos-amount-received">{t("amountReceived")}</Label>
          <div className="flex gap-2">
            <Input
              id="pos-amount-received"
              type="number"
              inputMode="decimal"
              min={0}
              value={amountReceived}
              aria-invalid={shortBy > 0}
              onChange={(e) => onAmountReceivedChange(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => onAmountReceivedChange(String(total))}
              disabled={!hasSellableLine}
            >
              {t("exactAmount")}
            </Button>
          </div>
          {shortBy > 0 && (
            <FieldError>
              {t("amountTooLow", { amount: formatPrice(shortBy, currency) })}
            </FieldError>
          )}
          {change !== null && hasSellableLine && (
            <p className="flex justify-between rounded-md border bg-card p-2 text-sm font-medium tabular-nums">
              <span>{t("change")}</span>
              <span>{formatPrice(change, currency)}</span>
            </p>
          )}
        </div>
      ) : (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-xs text-muted-foreground">{t("chooseWallet")}</legend>
          {wallets.map((wallet) => (
            <button
              key={wallet.id}
              type="button"
              aria-pressed={walletAccountId === wallet.id}
              onClick={() => onWalletAccountChange(wallet.id)}
              className={cn(
                "flex items-center justify-between rounded-md border p-3 text-start text-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
                walletAccountId === wallet.id && "border-primary bg-primary/5",
              )}
            >
              <span className="font-medium">{wallet.provider}</span>
              <span dir="ltr" className="text-xs text-muted-foreground">
                {wallet.number}
              </span>
            </button>
          ))}
        </fieldset>
      )}

      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={!canCharge}
        loading={pending}
        onClick={onCharge}
      >
        {t("charge", { total: formatPrice(total, currency) })}
      </Button>
    </div>
  );
}
