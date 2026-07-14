"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StockBadge } from "@/components/shop/stock-badge";
import { getVariantStockStatus } from "@/lib/shop/stock";
import { useCart } from "@/components/cart/cart-provider";
import { formatPrice } from "@/lib/format/currency";

type PlainVariant = {
  id: string;
  size: string;
  color: string;
  stock: number;
  lowStockThreshold: number;
  price: number;
};

export function VariantPicker({
  productId,
  productName,
  imageStoragePath,
  variants,
}: {
  productId: string;
  productName: string;
  imageStoragePath: string | null;
  variants: PlainVariant[];
}) {
  const t = useTranslations("products");
  const tCart = useTranslations("cart");
  const tCommon = useTranslations("common");
  const { addItem } = useCart();

  const sizes = useMemo(
    () => [...new Set(variants.map((v) => v.size))],
    [variants],
  );
  const colors = useMemo(
    () => [...new Set(variants.map((v) => v.color))],
    [variants],
  );

  const firstInStock = variants.find((v) => v.stock > 0) ?? variants[0];
  const [selectedSize, setSelectedSize] = useState(firstInStock?.size);
  const [selectedColor, setSelectedColor] = useState(firstInStock?.color);
  const [quantity, setQuantity] = useState(1);

  const resolvedVariant = variants.find(
    (v) => v.size === selectedSize && v.color === selectedColor,
  );

  function isSizeAvailable(size: string) {
    return variants.some((v) => v.size === size && v.stock > 0);
  }
  function isColorAvailable(color: string) {
    return variants.some((v) => v.color === color && v.stock > 0);
  }

  function handleAddToCart() {
    if (!resolvedVariant || resolvedVariant.stock <= 0) return;
    addItem(
      {
        variantId: resolvedVariant.id,
        productId,
        productName,
        size: resolvedVariant.size,
        color: resolvedVariant.color,
        unitPrice: resolvedVariant.price,
        imageStoragePath,
        stock: resolvedVariant.stock,
      },
      quantity,
    );
    toast.success(tCart("addedToCart"));
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-sm font-medium">{t("size")}</p>
        <div className="flex flex-wrap gap-2">
          {sizes.map((size) => (
            <Button
              key={size}
              type="button"
              variant={selectedSize === size ? "default" : "outline"}
              size="sm"
              disabled={!isSizeAvailable(size)}
              onClick={() => setSelectedSize(size)}
            >
              {size}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t("color")}</p>
        <div className="flex flex-wrap gap-2">
          {colors.map((color) => (
            <Button
              key={color}
              type="button"
              variant={selectedColor === color ? "default" : "outline"}
              size="sm"
              disabled={!isColorAvailable(color)}
              onClick={() => setSelectedColor(color)}
            >
              {color}
            </Button>
          ))}
        </div>
      </div>

      {resolvedVariant && (
        <div className="flex items-center gap-3">
          <p className="text-2xl font-bold text-primary">
            {formatPrice(resolvedVariant.price, tCommon("currency"))}
          </p>
          <StockBadge
            status={getVariantStockStatus(
              resolvedVariant.stock,
              resolvedVariant.lowStockThreshold,
            )}
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <Input
          type="number"
          min={1}
          max={resolvedVariant?.stock ?? 1}
          value={quantity}
          onChange={(e) =>
            setQuantity(
              Math.max(
                1,
                Math.min(Number(e.target.value) || 1, resolvedVariant?.stock ?? 1),
              ),
            )
          }
          className="w-20"
        />
        <Button
          type="button"
          size="lg"
          onClick={handleAddToCart}
          disabled={!resolvedVariant || resolvedVariant.stock <= 0}
          className="shadow-md shadow-primary/20"
        >
          {tCart("addToCart")}
        </Button>
      </div>
    </div>
  );
}
