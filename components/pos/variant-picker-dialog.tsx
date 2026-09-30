"use client";

import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPrice } from "@/lib/format/currency";
import { getSwatchStyle } from "@/lib/shop/color-swatch";
import type { PosProduct } from "@/lib/queries/pos";

type Variant = PosProduct["variants"][number];

export function VariantPickerDialog({
  product,
  quantityInCart,
  onPick,
  onClose,
}: {
  product: PosProduct | null;
  quantityInCart: (variantId: string) => number;
  onPick: (product: PosProduct, variant: Variant) => void;
  onClose: () => void;
}) {
  const t = useTranslations("pos");
  const tCommon = useTranslations("common");

  return (
    <Dialog open={product !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{product?.name}</DialogTitle>
          <DialogDescription>{t("chooseVariant")}</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60vh] grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
          {product?.variants.map((variant) => {
            const remaining = variant.stock - quantityInCart(variant.id);
            return (
              <button
                key={variant.id}
                type="button"
                disabled={remaining <= 0}
                onClick={() => onPick(product, variant)}
                className="flex items-center gap-3 rounded-md border p-3 text-start transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span
                  aria-hidden="true"
                  className="size-5 shrink-0 rounded-full border"
                  style={getSwatchStyle(variant.color)}
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">
                    {variant.size} · {variant.color}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {remaining > 0 ? t("inStock", { count: remaining }) : t("outOfStock")}
                  </span>
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {formatPrice(variant.price, tCommon("currency"))}
                </span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
