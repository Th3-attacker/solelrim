"use client";

import Image from "next/image";
import { ShoppingCart, Minus, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getDirection } from "@/i18n/routing";
import { useIsMobile } from "@/hooks/use-mobile";
import { getProductImageUrl } from "@/lib/supabase/storage";
import { useCart } from "@/components/cart/cart-provider";
import { useCheckoutDrawer } from "@/components/checkout/checkout-drawer-provider";
import { formatPrice } from "@/lib/format/currency";
import { cn } from "@/lib/utils";

export function CartTrigger() {
  const t = useTranslations("cart");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const isMobile = useIsMobile();
  const side = isMobile ? "bottom" : getDirection(locale) === "rtl" ? "left" : "right";
  const { items, hydrated, subtotal, updateQuantity, removeItem } = useCart();
  const { openCheckout } = useCheckoutDrawer();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <ShoppingCart className="size-4" />
          {hydrated && items.length > 0 && (
            <span className="absolute -top-1 -end-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
              {items.length}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        side={side}
        showHandle={side === "bottom"}
        className={cn(
          "flex flex-col gap-0",
          side === "bottom" && "max-h-[85svh] rounded-t-2xl",
        )}
      >
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <p className="px-4 text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="flex-1 overflow-y-auto px-4">
            <div className="flex flex-col gap-4">
              {items.map((line) => (
                <div key={line.variantId} className="flex gap-3">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-muted">
                    {line.imageStoragePath ? (
                      <Image
                        src={getProductImageUrl(line.imageStoragePath)}
                        alt={line.productName}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col gap-1">
                    <p className="text-sm font-medium">{line.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {line.size} · {line.color}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-6"
                        onClick={() =>
                          updateQuantity(line.variantId, line.quantity - 1)
                        }
                      >
                        <Minus className="size-3" />
                      </Button>
                      <span className="w-4 text-center text-sm">
                        {line.quantity}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-6"
                        disabled={line.quantity >= line.stock}
                        onClick={() =>
                          updateQuantity(line.variantId, line.quantity + 1)
                        }
                      >
                        <Plus className="size-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-col items-end justify-between">
                    <p className="text-sm font-medium">
                      {formatPrice(line.unitPrice * line.quantity, tCommon("currency"))}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      onClick={() => removeItem(line.variantId)}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {items.length > 0 && (
          <SheetFooter className="border-t pt-4">
            <div className="flex items-center justify-between text-sm font-medium">
              <span>{t("subtotal")}</span>
              <span>{formatPrice(subtotal, tCommon("currency"))}</span>
            </div>
            <SheetClose asChild>
              <Button type="button" className="w-full" onClick={openCheckout}>
                {t("checkoutButton")}
              </Button>
            </SheetClose>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
