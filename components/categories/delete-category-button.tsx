"use client";

import { useTranslations } from "next-intl";
import { ConfirmDeleteButton } from "@/components/ui/confirm-delete-button";
import { deleteCategory } from "@/lib/actions/categories";

export function DeleteCategoryButton({ categoryId }: { categoryId: string }) {
  const t = useTranslations("categories");
  const tCommon = useTranslations("common");

  return (
    <ConfirmDeleteButton
      title={t("deleteConfirm")}
      description={t("hasProductsError")}
      onDelete={() => deleteCategory(categoryId)}
      errorMessage={(error) => (error === "hasProducts" ? t("hasProductsError") : tCommon("error"))}
    />
  );
}
