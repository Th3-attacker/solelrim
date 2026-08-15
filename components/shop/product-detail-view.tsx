"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ProductGallery } from "@/components/shop/product-gallery";
import { VariantPicker, type PlainVariant } from "@/components/shop/variant-picker";
import { Price } from "@/components/shop/price";
import { Badge } from "@/components/ui/badge";
import type { ProductType } from "@/lib/shop/product-type";

type GalleryImage = { id: string; url: string; storagePath: string; color: string | null };

export function ProductDetailView({
  productId,
  productName,
  productType,
  description,
  basePrice,
  compareAtPrice,
  isNew,
  isFeatured,
  images,
  variants,
}: {
  productId: string;
  productName: string;
  productType: ProductType;
  description: string | null;
  basePrice: number;
  compareAtPrice: number | null;
  isNew: boolean;
  isFeatured: boolean;
  images: GalleryImage[];
  variants: PlainVariant[];
}) {
  const t = useTranslations("shop");
  const tCommon = useTranslations("common");

  const firstInStock = variants.find((v) => v.stock > 0) ?? variants[0];
  const [selectedSize, setSelectedSize] = useState(firstInStock?.size);
  const [selectedColor, setSelectedColor] = useState(firstInStock?.color);
  const [selectedImageIndex, setSelectedImageIndex] = useState(() => {
    const idx = images.findIndex((image) => image.color === firstInStock?.color);
    return idx >= 0 ? idx : 0;
  });

  const resolvedVariant = variants.find(
    (v) => v.size === selectedSize && v.color === selectedColor,
  );
  const effectivePrice = resolvedVariant?.price ?? basePrice;
  const promo = compareAtPrice != null && compareAtPrice > effectivePrice;

  // Picking a color jumps the gallery to a photo tagged with it, when one
  // exists — picking a photo tagged with a color does the reverse. Photos
  // with no color tag (packaging, lifestyle shots) never touch the color
  // selection, in either direction.
  function handleColorChange(color: string) {
    setSelectedColor(color);
    const idx = images.findIndex((image) => image.color === color);
    if (idx >= 0) setSelectedImageIndex(idx);
  }

  function handleImageSelect(index: number) {
    setSelectedImageIndex(index);
    const color = images[index]?.color;
    if (color) setSelectedColor(color);
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <ProductGallery
        images={images}
        productName={productName}
        selectedIndex={selectedImageIndex}
        onSelect={handleImageSelect}
      />

      <div className="flex flex-col gap-2">
        <h1 className="text-heading-sm">{productName}</h1>

        {(promo || isNew || isFeatured) && (
          <div className="flex flex-wrap gap-1">
            {promo && (
              <Badge className="border-0 bg-foreground text-background">
                {t("promoBadge")}
              </Badge>
            )}
            {isNew && <Badge variant="outline">{t("newBadge")}</Badge>}
            {isFeatured && <Badge variant="outline">{t("bestSellerBadge")}</Badge>}
          </div>
        )}

        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
          <Price
            value={effectivePrice}
            currency={tCommon("currency")}
            size="lg"
            emphasize={promo}
          />
          {promo && compareAtPrice != null && (
            <Price value={compareAtPrice} size="lg" strikethrough />
          )}
        </p>

        {description && (
          <p className="text-paragraph-sm text-muted-foreground">{description}</p>
        )}

        <div className="mt-4">
          <VariantPicker
            productId={productId}
            productName={productName}
            imageStoragePath={
              images[selectedImageIndex]?.storagePath ?? images[0]?.storagePath ?? null
            }
            productType={productType}
            variants={variants}
            selectedSize={selectedSize}
            selectedColor={selectedColor}
            onSizeChange={setSelectedSize}
            onColorChange={handleColorChange}
          />
        </div>
      </div>
    </div>
  );
}
