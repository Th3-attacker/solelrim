"use client";

import { ShoppingCart } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useCart } from "@/components/cart/cart-provider";
import { cn } from "@/lib/utils";

type DefaultVariant = {
  id: string;
  size: string;
  color: string;
  stock: number;
  unitPrice: number;
};

// Always adds directly on click, no size/color picker — for a multi-variant
// product this adds whichever in-stock variant ProductCard resolved as the
// default (first in stock). The cart line still shows that size/color, so
// the customer can adjust it from the cart drawer if it's not the one they
// wanted.
export function QuickAddButton({
  productId,
  productName,
  imageStoragePath,
  variant,
  className,
}: {
  productId: string;
  productName: string;
  imageStoragePath: string | null;
  variant: DefaultVariant;
  className?: string;
}) {
  const t = useTranslations("cart");
  const { addItem } = useCart();

  return (
    <Button
      type="button"
      size="icon-sm"
      aria-label={t("addToCart")}
      className={cn("relative z-10", className)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        addItem({
          variantId: variant.id,
          productId,
          productName,
          size: variant.size,
          color: variant.color,
          unitPrice: variant.unitPrice,
          imageStoragePath,
          stock: variant.stock,
        });
        toast.success(t("addedToCart"));
      }}
    >
      <ShoppingCart className="size-3.5" />
    </Button>
  );
}
