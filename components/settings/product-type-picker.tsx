"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { setProductType } from "@/lib/actions/settings";
import { PRODUCT_TYPES, type ProductType } from "@/lib/shop/product-type";

export function ProductTypePicker({
  currentProductType,
}: {
  currentProductType: string;
}) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const [pending, startTransition] = useTransition();

  function handleSelect(productType: ProductType) {
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

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{t("productTypeSection")}</span>
      <p className="text-sm text-muted-foreground">{t("productTypeHint")}</p>
      <div className="flex gap-2">
        {PRODUCT_TYPES.map((productType) => (
          <Button
            key={productType}
            type="button"
            variant={productType === currentProductType ? "default" : "outline"}
            disabled={pending}
            onClick={() => handleSelect(productType)}
          >
            {t(`productTypes.${productType}`)}
          </Button>
        ))}
      </div>
    </div>
  );
}
