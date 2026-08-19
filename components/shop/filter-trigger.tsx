"use client";

import { SlidersHorizontal } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function FilterTrigger({
  open,
  onToggle,
  activeCount,
}: {
  open: boolean;
  onToggle: () => void;
  activeCount: number;
}) {
  const t = useTranslations("shop");

  return (
    <Button variant="outline" size="sm" onClick={onToggle} aria-expanded={open}>
      <SlidersHorizontal className="size-4" />
      {t("filters")}
      {activeCount > 0 && (
        <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
          {activeCount}
        </span>
      )}
    </Button>
  );
}
