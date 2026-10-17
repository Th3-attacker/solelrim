"use client";

import { useTranslations } from "next-intl";
import { ConfirmDeleteButton } from "@/components/ui/confirm-delete-button";
import { deleteProduct } from "@/lib/actions/products";

export function DeleteProductButton({ productId }: { productId: string }) {
  const t = useTranslations("products");

  return (
    <ConfirmDeleteButton
      title={t("deleteConfirm")}
      description={t("hasSalesError")}
      onDelete={() => deleteProduct(productId)}
      errorMessage={(error) => t(error === "hasSales" ? "hasSalesError" : "deleteError")}
    />
  );
}
