"use client";

import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter, usePathname } from "@/i18n/navigation";

type Category = { id: string; name: string };

const ALL_VALUE = "__all__";

export function CategorySelect({
  categories,
  activeCategoryId,
}: {
  categories: Category[];
  activeCategoryId?: string;
}) {
  const t = useTranslations("shop");
  const router = useRouter();
  const pathname = usePathname();

  return (
    <Select
      value={activeCategoryId ?? ALL_VALUE}
      onValueChange={(value) =>
        router.push(
          value === ALL_VALUE ? pathname : `${pathname}?category=${value}`,
        )
      }
    >
      <SelectTrigger className="w-full sm:w-64" aria-label={t("categorySelectLabel")}>
        <SelectValue placeholder={t("categorySelectLabel")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VALUE}>{t("allCategories")}</SelectItem>
        {categories.map((category) => (
          <SelectItem key={category.id} value={category.id}>
            {category.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
