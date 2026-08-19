"use client";

import { useState, useTransition } from "react";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { createCategory } from "@/lib/actions/categories";

export function CreateCategoryButton() {
  const t = useTranslations("categories");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function handleCreate() {
    startTransition(async () => {
      const result = await createCategory(name);
      if (result.error) {
        toast.error(tCommon("error"));
        return;
      }
      setName("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button type="button">
          <Plus className="size-4" />
          {t("newCategory")}
        </Button>
      }
      title={t("newCategory")}
      footer={
        <Button type="button" disabled={!name.trim()} loading={pending} onClick={handleCreate}>
          {tCommon("create")}
        </Button>
      }
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-category-name">{t("name")}</Label>
        <Input id="new-category-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
    </ResponsiveFormDialog>
  );
}
