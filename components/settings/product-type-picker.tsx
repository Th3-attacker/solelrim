"use client";

import { useState, useTransition } from "react";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { setProductType, createProductType } from "@/lib/actions/settings";
import { isProductType } from "@/lib/shop/product-type";

type StoreTypeOption = { key: string; label: string };

export function ProductTypePicker({
  storeTypes,
  currentProductType,
}: {
  storeTypes: StoreTypeOption[];
  currentProductType: string;
}) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [categoriesText, setCategoriesText] = useState("");

  function handleSelect(productType: string) {
    if (productType === currentProductType || pending) return;
    startTransition(async () => {
      const result = await setProductType(productType);
      if (result.error) {
        toast.error(tCommon("error"));
        return;
      }
      window.location.reload();
    });
  }

  function handleCreate() {
    const categories = categoriesText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    startTransition(async () => {
      const result = await createProductType({ name, categories });
      if (result.error) {
        toast.error(tCommon("error"));
        return;
      }
      window.location.reload();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{t("productTypeSection")}</span>
      <p className="text-sm text-muted-foreground">{t("productTypeHint")}</p>
      <div className="flex flex-wrap gap-2">
        {storeTypes.map(({ key, label }) => (
          <Button
            key={key}
            type="button"
            variant={key === currentProductType ? "default" : "outline"}
            disabled={pending}
            onClick={() => handleSelect(key)}
          >
            {isProductType(key) ? t(`productTypes.${key}`) : label}
          </Button>
        ))}

        <ResponsiveFormDialog
          open={open}
          onOpenChange={setOpen}
          trigger={
            <Button type="button" variant="outline" disabled={pending}>
              <Plus className="size-4" />
              {t("productTypeNew")}
            </Button>
          }
          title={t("productTypeNewTitle")}
          footer={
            <Button
              type="button"
              disabled={!name.trim()}
              loading={pending}
              onClick={handleCreate}
            >
              {tCommon("create")}
            </Button>
          }
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-product-type-name">
                {t("productTypeNewName")}
              </Label>
              <Input
                id="new-product-type-name"
                value={name}
                placeholder={t("productTypeNewNamePlaceholder")}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-product-type-categories">
                {t("productTypeNewCategories")}
              </Label>
              <Textarea
                id="new-product-type-categories"
                rows={4}
                value={categoriesText}
                placeholder={t("productTypeNewCategoriesPlaceholder")}
                onChange={(e) => setCategoriesText(e.target.value)}
              />
            </div>
          </div>
        </ResponsiveFormDialog>
      </div>
    </div>
  );
}
