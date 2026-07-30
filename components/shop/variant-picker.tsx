"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StockBadge } from "@/components/shop/stock-badge";
import { FavoriteButton } from "@/components/shop/favorite-button";
import { ShareButton } from "@/components/shop/share-button";
import { getVariantStockStatus } from "@/lib/shop/stock";
import { getSwatchStyle } from "@/lib/shop/color-swatch";
import { useCart } from "@/components/cart/cart-provider";
import { cn } from "@/lib/utils";
import type { ProductType } from "@/lib/shop/product-type";

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
  productType,
}: {
  productId: string;
  productName: string;
  imageStoragePath: string | null;
  variants: PlainVariant[];
  productType: ProductType;
}) {
  const t = useTranslations("products");
  const tCart = useTranslations("cart");
  const sizeLabel = productType === "cosmetique" ? t("sizeCosmetic") : t("size");
  const colorLabel = productType === "cosmetique" ? t("colorCosmetic") : t("color");

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
      {sizes.length > 1 && (
        <div>
          <p className="mb-2 text-sm font-medium">{sizeLabel}</p>
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
      )}

      <div className="divide-y divide-border rounded-lg border">
        {colors.length > 1 && (
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-sm font-medium">{colorLabel}</p>
            <div className="flex items-center gap-2">
              {colors.map((color) => {
                const available = isColorAvailable(color);
                return (
                  <button
                    key={color}
                    type="button"
                    title={color}
                    aria-pressed={selectedColor === color}
                    disabled={!available}
                    onClick={() => setSelectedColor(color)}
                    className={cn(
                      "size-6 rounded-full ring-1 ring-offset-2 ring-offset-background transition-all",
                      selectedColor === color
                        ? "ring-2 ring-foreground"
                        : "ring-inset ring-foreground/15",
                      !available && "cursor-not-allowed opacity-30",
                    )}
                    style={getSwatchStyle(color)}
                  />
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm font-medium">{tCart("quantity")}</p>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
            >
              <Minus className="size-3" />
            </Button>
            <span className="w-4 text-center text-sm tabular-nums">{quantity}</span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() =>
                setQuantity((q) => Math.min(resolvedVariant?.stock ?? 1, q + 1))
              }
              disabled={!resolvedVariant || quantity >= resolvedVariant.stock}
            >
              <Plus className="size-3" />
            </Button>
          </div>
        </div>
      </div>

      {resolvedVariant && (
        <StockBadge
          status={getVariantStockStatus(
            resolvedVariant.stock,
            resolvedVariant.lowStockThreshold,
          )}
        />
      )}

      <Button
        type="button"
        size="lg"
        className="w-full"
        onClick={handleAddToCart}
        disabled={!resolvedVariant || resolvedVariant.stock <= 0}
      >
        {tCart("addToCart")}
      </Button>

      <div className="flex items-center gap-2">
        <FavoriteButton productId={productId} className="border" />
        <ShareButton title={productName} className="border" />
      </div>
    </div>
  );
}
