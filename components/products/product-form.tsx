"use client";

import { useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast";
import type { z } from "zod";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { CategorySelect } from "@/components/products/category-select";
import { VariantFields } from "@/components/products/variant-fields";
import { productSchema, type ProductInput } from "@/lib/validation/product";
import { createProduct, updateProduct } from "@/lib/actions/products";
import type { ProductType } from "@/lib/shop/product-type";

type Category = { id: string; name: string };
type ProductFormValues = z.input<typeof productSchema>;

export function ProductForm({
  categories,
  defaultValues,
  productId,
  productType,
}: {
  categories: Category[];
  defaultValues?: ProductInput;
  productId?: string;
  productType: ProductType;
}) {
  const t = useTranslations("products");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProductFormValues, unknown, ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: defaultValues ?? {
      name: "",
      description: "",
      basePrice: 0,
      compareAtPrice: null,
      isFeatured: false,
      categoryId: categories[0]?.id ?? "",
      isActive: true,
      variants: [
        { size: "", color: "", sku: "", stock: 0, lowStockThreshold: 5 },
      ],
    },
  });

  const onSubmit: SubmitHandler<ProductInput> = async (data) => {
    setSubmitting(true);
    const result = productId
      ? await updateProduct(productId, data)
      : await createProduct(data);
    setSubmitting(false);

    if (result.error) {
      toast.error(
        result.error === "duplicateSku" ? t("duplicateSkuError") : tCommon("error"),
      );
      return;
    }

    router.push(`/admin/products/${result.productId}/edit`);
    router.refresh();
    toast.success(tCommon("save"));
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="name">{t("name")}</Label>
            <Input id="name" {...register("name")} />
            {errors.name && (
              <p className="text-sm text-destructive">{tCommon("requiredField")}</p>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="description">{t("description")}</Label>
            <Textarea id="description" {...register("description")} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="basePrice">{t("basePrice")}</Label>
            <Input
              id="basePrice"
              type="number"
              step="0.01"
              {...register("basePrice")}
            />
            {errors.basePrice && (
              <p className="text-sm text-destructive">{tCommon("requiredField")}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="compareAtPrice">
              {t("compareAtPrice")} ({tCommon("optional")})
            </Label>
            <Input
              id="compareAtPrice"
              type="number"
              step="0.01"
              {...register("compareAtPrice")}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>{t("category")}</Label>
            <CategorySelect
              categories={categories}
              value={watch("categoryId")}
              onChange={(id) => setValue("categoryId", id)}
            />
            {errors.categoryId && (
              <p className="text-sm text-destructive">{tCommon("requiredField")}</p>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={watch("isActive")}
              onCheckedChange={(checked) => setValue("isActive", checked === true)}
            />
            {t("active")}
          </label>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={watch("isFeatured")}
              onCheckedChange={(checked) => setValue("isFeatured", checked === true)}
            />
            {t("isFeatured")}
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <VariantFields
            control={control}
            register={register}
            errors={errors}
            productType={productType}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="submit" loading={submitting}>
          {tCommon("save")}
        </Button>
      </div>
    </form>
  );
}
