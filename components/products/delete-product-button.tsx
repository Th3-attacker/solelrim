"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ConfirmDeleteButton } from "@/components/ui/confirm-delete-button";
import { deleteProduct } from "@/lib/actions/products";

export function DeleteProductButton({ productId }: { productId: string }) {
  const t = useTranslations("products");
  const router = useRouter();

  return (
    <ConfirmDeleteButton
      title={t("deleteConfirm")}
      description={t("hasSalesError")}
      onDelete={() => deleteProduct(productId)}
      errorMessage={(error) => t(error === "hasSales" ? "hasSalesError" : "deleteError")}
      onDeleted={() => router.refresh()}
    />
  );
}
