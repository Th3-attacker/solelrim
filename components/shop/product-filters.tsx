"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { SlidersHorizontal } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useRouter, usePathname } from "@/i18n/navigation";
import { getDirection } from "@/i18n/routing";
import { getSwatchColor } from "@/lib/shop/color-swatch";
import { formatPrice } from "@/lib/format/currency";
import { PRICE_BUCKETS, SORT_OPTIONS } from "@/lib/shop/filters";
import { cn } from "@/lib/utils";

function OptionButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 py-1 text-start text-sm transition-colors",
        active ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function ProductFilters({
  colors,
  categoryId,
}: {
  colors: string[];
  categoryId?: string;
}) {
  const t = useTranslations("shop");
  const tProducts = useTranslations("products");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const side = getDirection(locale) === "rtl" ? "left" : "right";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [sort, setSort] = useState(searchParams.get("sort") ?? "default");
  const [price, setPrice] = useState(searchParams.get("price") ?? "all");
  const [color, setColor] = useState(searchParams.get("color") ?? "");

  const activeCount = [sort !== "default", price !== "all", Boolean(color)].filter(
    Boolean,
  ).length;

  function navigate(next: { sort: string; price: string; color: string }) {
    const params = new URLSearchParams();
    if (categoryId) params.set("category", categoryId);
    if (next.sort !== "default") params.set("sort", next.sort);
    if (next.price !== "all") params.set("price", next.price);
    if (next.color) params.set("color", next.color);
    const query = params.toString();
    router.push(`${pathname}${query ? `?${query}` : ""}#catalog`);
  }

  function handleReset() {
    setSort("default");
    setPrice("all");
    setColor("");
    navigate({ sort: "default", price: "all", color: "" });
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <SlidersHorizontal className="size-4" />
          {t("filters")}
          {activeCount > 0 && (
            <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side={side} className="flex flex-col gap-0">
        <SheetHeader>
          <SheetTitle>{t("filters")}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4">
          <div className="flex flex-col gap-1">
            <h3 className="mb-1 text-sm font-medium">{t("sortBy")}</h3>
            {SORT_OPTIONS.map((option) => (
              <OptionButton
                key={option.value}
                active={sort === option.value}
                onClick={() => setSort(option.value)}
              >
                {t(option.labelKey)}
              </OptionButton>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            <h3 className="mb-1 text-sm font-medium">{tProducts("price")}</h3>
            <OptionButton active={price === "all"} onClick={() => setPrice("all")}>
              {t("allCategories")}
            </OptionButton>
            {PRICE_BUCKETS.map((bucket) => (
              <OptionButton
                key={bucket.value}
                active={price === bucket.value}
                onClick={() => setPrice(bucket.value)}
              >
                <span dir="ltr">
                  {formatPrice(bucket.min, tCommon("currency"))}
                  {bucket.max === Infinity
                    ? "+"
                    : ` - ${formatPrice(bucket.max, tCommon("currency"))}`}
                </span>
              </OptionButton>
            ))}
          </div>

          {colors.length > 0 && (
            <div className="flex flex-col gap-1">
              <h3 className="mb-1 text-sm font-medium">{tProducts("color")}</h3>
              {colors.map((c) => (
                <OptionButton
                  key={c}
                  active={color === c}
                  onClick={() => setColor(color === c ? "" : c)}
                >
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full ring-1 ring-inset ring-foreground/15"
                    style={{ backgroundColor: getSwatchColor(c) }}
                  />
                  {c}
                </OptionButton>
              ))}
            </div>
          )}
        </div>

        <SheetFooter className="flex-row border-t">
          <SheetClose asChild>
            <Button variant="outline" className="flex-1" onClick={handleReset}>
              {t("resetFilters")}
            </Button>
          </SheetClose>
          <SheetClose asChild>
            <Button className="flex-1" onClick={() => navigate({ sort, price, color })}>
              {t("applyFilters")}
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
