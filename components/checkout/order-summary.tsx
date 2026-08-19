import { ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { formatPrice } from "@/lib/format/currency";
import type { CartLine } from "@/components/cart/cart-provider";

export function OrderSummary({
  items,
  subtotal,
  discount,
  discountCode,
  total,
  currency,
}: {
  items: CartLine[];
  subtotal: number;
  discount: number;
  discountCode: string | null;
  total: number;
  currency: string;
}) {
  const t = useTranslations("checkout");
  const tCart = useTranslations("cart");

  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-muted/30 p-5">
      <h2 className="text-label-xs">{t("orderSummary")}</h2>

      <div className="flex flex-col gap-3">
        {items.map((line) => (
          <div key={line.variantId} className="flex justify-between gap-3 text-sm">
            <span className="text-muted-foreground">
              <span className="text-foreground">{line.productName}</span>
              <br />
              {line.size} · {line.color} · x{line.quantity}
            </span>
            <span className="shrink-0 font-medium">
              {formatPrice(line.unitPrice * line.quantity, currency)}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1.5 border-t pt-3">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{tCart("subtotal")}</span>
          <span>{formatPrice(subtotal, currency)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-sm text-primary">
            <span>
              {t("discount")}
              {discountCode ? ` (${discountCode})` : ""}
            </span>
            <span>-{formatPrice(discount, currency)}</span>
          </div>
        )}
        <div className="flex justify-between border-t pt-2 text-base font-semibold">
          <span>{t("total")}</span>
          <span>{formatPrice(total, currency)}</span>
        </div>
      </div>

      <div className="flex items-start gap-2 border-t pt-3 text-xs text-muted-foreground">
        <ShieldCheck className="size-4 shrink-0 text-primary" />
        {t("orderVerifiedHint")}
      </div>
    </div>
  );
}
