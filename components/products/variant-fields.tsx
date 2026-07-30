"use client";

import {
  useFieldArray,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";
import { Trash2, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { productSchema } from "@/lib/validation/product";
import type { ProductType } from "@/lib/shop/product-type";

type ProductFormValues = z.input<typeof productSchema>;

export function VariantFields({
  control,
  register,
  errors,
  productType,
}: {
  control: Control<ProductFormValues>;
  register: UseFormRegister<ProductFormValues>;
  errors: FieldErrors<ProductFormValues>;
  productType: ProductType;
}) {
  const t = useTranslations("products");
  const tCommon = useTranslations("common");
  const sizeLabel = productType === "cosmetique" ? t("sizeCosmetic") : t("size");
  const colorLabel = productType === "cosmetique" ? t("colorCosmetic") : t("color");
  const { fields, append, remove } = useFieldArray({
    control,
    name: "variants",
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Label>{t("variants")}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            append({
              size: "",
              color: "",
              sku: "",
              price: null,
              stock: 0,
              lowStockThreshold: 5,
            })
          }
        >
          <Plus className="size-4" />
          {t("addVariant")}
        </Button>
      </div>

      {errors.variants?.root && (
        <p className="text-sm text-destructive">{errors.variants.root.message}</p>
      )}

      <div className="flex flex-col gap-3">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="grid grid-cols-2 gap-2 rounded-md border p-3 sm:grid-cols-6"
          >
            <div className="flex flex-col gap-1">
              <Label className="text-xs">{sizeLabel}</Label>
              <Input {...register(`variants.${index}.size`)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">{colorLabel}</Label>
              <Input {...register(`variants.${index}.color`)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">{t("sku")}</Label>
              <Input {...register(`variants.${index}.sku`)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">
                {t("price")} ({tCommon("optional")})
              </Label>
              <Input
                type="number"
                step="0.01"
                {...register(`variants.${index}.price`)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">{t("stock")}</Label>
              <Input type="number" {...register(`variants.${index}.stock`)} />
            </div>
            <div className="flex items-end gap-1">
              <div className="flex flex-1 flex-col gap-1">
                <Label className="text-xs">{t("lowStockThreshold")}</Label>
                <Input
                  type="number"
                  {...register(`variants.${index}.lowStockThreshold`)}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(index)}
                disabled={fields.length <= 1}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
