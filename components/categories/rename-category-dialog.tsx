"use client";

import { useState, useTransition } from "react";
import { Pencil } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { updateCategory } from "@/lib/actions/categories";

export function RenameCategoryDialog({
  categoryId,
  currentName,
}: {
  categoryId: string;
  currentName: string;
}) {
  const t = useTranslations("categories");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [pending, startTransition] = useTransition();

  function handleRename() {
    startTransition(async () => {
      const result = await updateCategory(categoryId, name);
      if (result.error) {
        toast.error(
          result.error === "duplicateName" ? t("duplicateNameError") : tCommon("error"),
        );
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button type="button" variant="ghost" size="icon" aria-label={tCommon("edit")}>
          <Pencil className="size-4" />
        </Button>
      }
      title={t("renameCategory")}
      footer={
        <Button
          type="button"
          disabled={!name.trim()}
          loading={pending}
          onClick={handleRename}
        >
          {tCommon("save")}
        </Button>
      }
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor={`rename-category-${categoryId}`}>{t("name")}</Label>
        <Input
          id={`rename-category-${categoryId}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
    </ResponsiveFormDialog>
  );
}
