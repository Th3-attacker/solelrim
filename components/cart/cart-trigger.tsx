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
import { Link } from "@/i18n/navigation";
import { getDirection } from "@/i18n/routing";
import { getProductImageUrl } from "@/lib/supabase/storage";
import { useCart } from "@/components/cart/cart-provider";

export function CartTrigger() {
  const t = useTranslations("cart");
  const locale = useLocale();
  const side = getDirection(locale) === "rtl" ? "left" : "right";
  const { items, hydrated, itemCount, subtotal, updateQuantity, removeItem } =
    useCart();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <ShoppingCart className="size-4" />
          {hydrated && itemCount > 0 && (
            <span className="absolute -top-1 -end-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
              {itemCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side={side} className="flex flex-col gap-0">
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
                      {(line.unitPrice * line.quantity).toFixed(2)}
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
              <span>{subtotal.toFixed(2)}</span>
            </div>
            <SheetClose asChild>
              <Button asChild className="w-full">
                <Link href="/checkout">{t("checkoutButton")}</Link>
              </Button>
            </SheetClose>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
