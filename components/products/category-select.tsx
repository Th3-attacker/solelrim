"use client";

import { useState, useTransition } from "react";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { createCategory } from "@/lib/actions/categories";

type Category = { id: string; name: string };

export function CategorySelect({
  categories,
  value,
  onChange,
}: {
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
}) {
  const t = useTranslations("products");
  const tCommon = useTranslations("common");
  const [items, setItems] = useState(categories);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function handleCreate() {
    startTransition(async () => {
      const result = await createCategory(name);
      if (result.category) {
        setItems((prev) => [...prev, result.category].sort((a, b) => a.name.localeCompare(b.name)));
        onChange(result.category.id);
        setName("");
        setOpen(false);
      }
    });
  }

  return (
    <div className="flex gap-2">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder={t("category")} />
        </SelectTrigger>
        <SelectContent>
          {items.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {category.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ResponsiveFormDialog
        open={open}
        onOpenChange={setOpen}
        trigger={
          <Button type="button" variant="outline" size="icon" aria-label={t("addCategory")}>
            <Plus className="size-4" />
          </Button>
        }
        title={t("category")}
        footer={
          <Button
            type="button"
            disabled={!name}
            loading={pending}
            onClick={handleCreate}
          >
            {tCommon("create")}
          </Button>
        }
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-category-name">{t("name")}</Label>
          <Input
            id="new-category-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      </ResponsiveFormDialog>
    </div>
  );
}
