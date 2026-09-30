"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DayPicker({ value, max }: { value: string; max: string }) {
  const t = useTranslations("cash");
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="cash-day" className="shrink-0">
        {t("day")}
      </Label>
      <Input
        id="cash-day"
        type="date"
        className="w-auto"
        value={value}
        max={max}
        onChange={(e) => {
          if (e.target.value) router.replace(`${pathname}?date=${e.target.value}`);
        }}
      />
    </div>
  );
}
