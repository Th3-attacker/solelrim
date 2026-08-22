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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";
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
  const [pendingSwitch, setPendingSwitch] = useState<{ key: string; displayName: string } | null>(
    null,
  );

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

  function handleConfirmSwitch() {
    if (!pendingSwitch) return;
    handleSelect(pendingSwitch.key);
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
        {storeTypes.map(({ key, label }) => {
          const displayName = isProductType(key) ? t(`productTypes.${key}`) : label;
          return (
            <Button
              key={key}
              type="button"
              variant={key === currentProductType ? "default" : "outline"}
              disabled={pending}
              onClick={() => {
                if (key === currentProductType) return;
                setPendingSwitch({ key, displayName });
              }}
            >
              {displayName}
            </Button>
          );
        })}

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

      <AlertDialog
        open={pendingSwitch !== null}
        onOpenChange={(next) => {
          if (!next) setPendingSwitch(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("productTypeSwitchConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingSwitch &&
                t("productTypeSwitchConfirmBody", { name: pendingSwitch.displayName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSwitch} disabled={pending}>
              {pending ? <Spinner /> : tCommon("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
