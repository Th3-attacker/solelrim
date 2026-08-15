"use client";

import { useState } from "react";
import { useFieldArray, useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast";
import type { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saleSchema, type SaleInput } from "@/lib/validation/sale";
import { createSale } from "@/lib/actions/sales";
import { formatPrice } from "@/lib/format/currency";

type Client = { id: string; fullName: string };
type Variant = {
  id: string;
  size: string;
  color: string;
  sku: string;
  stock: number;
  price: number;
  productName: string;
};

type SaleFormValues = z.input<typeof saleSchema>;

export function SaleForm({
  clients,
  variants,
}: {
  clients: Client[];
  variants: Variant[];
}) {
  const t = useTranslations("sales");
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
  } = useForm<SaleFormValues, unknown, SaleInput>({
    resolver: zodResolver(saleSchema),
    defaultValues: {
      clientId: null,
      discount: 0,
      paymentMethod: null,
      notes: "",
      items: [{ variantId: variants[0]?.id ?? "", quantity: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const onSubmit: SubmitHandler<SaleInput> = async (data) => {
    setSubmitting(true);
    const result = await createSale(data);
    setSubmitting(false);

    if (result.error) {
      toast.error(
        result.error === "insufficientStock"
          ? t("insufficientStock")
          : tCommon("error"),
      );
      return;
    }

    router.push(`/admin/sales/${result.saleId}`);
    router.refresh();
    toast.success(tCommon("save"));
  };

  const watchedItems = watch("items");
  const total = watchedItems.reduce((sum, item) => {
    const variant = variants.find((v) => v.id === item.variantId);
    const quantity = Number(item.quantity) || 0;
    return sum + (variant ? variant.price * quantity : 0);
  }, 0);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label>{t("client")}</Label>
            <Select
              value={(watch("clientId") as string | null) ?? "__walkin__"}
              onValueChange={(value) =>
                setValue("clientId", value === "__walkin__" ? null : value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__walkin__">{t("walkInClient")}</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="discount">{t("discount")}</Label>
            <Input
              id="discount"
              type="number"
              step="0.01"
              {...register("discount")}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="paymentMethod">{t("paymentMethod")}</Label>
            <Select
              value={(watch("paymentMethod") as string | null) ?? "__none__"}
              onValueChange={(value) =>
                setValue("paymentMethod", value === "__none__" ? null : value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                <SelectItem value="cash">{t("cash")}</SelectItem>
                <SelectItem value="card">{t("card")}</SelectItem>
                <SelectItem value="transfer">{t("transfer")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="notes">{t("notes")}</Label>
            <Textarea id="notes" {...register("notes")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <div className="flex items-center justify-between">
            <Label>{t("addItem")}</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ variantId: variants[0]?.id ?? "", quantity: 1 })}
            >
              <Plus className="size-4" />
              {t("addItem")}
            </Button>
          </div>

          {fields.map((field, index) => (
            <div
              key={field.id}
              className="grid grid-cols-1 items-end gap-2 sm:grid-cols-6"
            >
              <div className="flex flex-col gap-1 sm:col-span-4">
                <Label className="text-xs">{t("selectVariant")}</Label>
                <Select
                  value={watch(`items.${index}.variantId`)}
                  onValueChange={(value) =>
                    setValue(`items.${index}.variantId`, value)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {variants.map((variant) => (
                      <SelectItem key={variant.id} value={variant.id}>
                        {variant.productName} — {variant.size}/{variant.color} (
                        {variant.stock}) — {formatPrice(variant.price, tCommon("currency"))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 sm:col-span-2">
                <div className="flex flex-1 flex-col gap-1">
                  <Label className="text-xs">{t("quantity")}</Label>
                  <Input
                    type="number"
                    min={1}
                    {...register(`items.${index}.quantity`)}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                  disabled={fields.length <= 1}
                  aria-label={tCommon("delete")}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}

          {errors.items?.root && (
            <p className="text-sm text-destructive">{tCommon("requiredField")}</p>
          )}

          <div className="flex justify-end text-sm font-medium">
            {t("total")}: {formatPrice(total, tCommon("currency"))}
          </div>
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
