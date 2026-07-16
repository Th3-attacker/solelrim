"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { SlidersHorizontal } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { useRouter, usePathname } from "@/i18n/navigation";
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [open, setOpen] = useState(false);
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
    setOpen(false);
  }

  function handleReset() {
    setSort("default");
    setPrice("all");
    setColor("");
    navigate({ sort: "default", price: "all", color: "" });
  }

  const sortOptions = (
    <div className="flex flex-col gap-1">
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
  );

  const priceOptions = (
    <div className="flex flex-col gap-1">
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
  );

  const colorOptions =
    colors.length > 0 ? (
      <div className="flex flex-col gap-1">
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
    ) : null;

  return (
    <div>
      <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
        <SlidersHorizontal className="size-4" />
        {t("filters")}
        {activeCount > 0 && (
          <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
            {activeCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="animate-in fade-in slide-in-from-top-2 mt-4 rounded-lg border p-4 duration-200">
          <div className="hidden md:grid md:grid-cols-3 md:gap-8">
            <div>
              <h3 className="mb-2 text-sm font-medium">{t("sortBy")}</h3>
              {sortOptions}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium">{tProducts("price")}</h3>
              {priceOptions}
            </div>
            {colorOptions && (
              <div>
                <h3 className="mb-2 text-sm font-medium">{tProducts("color")}</h3>
                {colorOptions}
              </div>
            )}
          </div>

          <Accordion type="single" collapsible defaultValue="sort" className="md:hidden">
            <AccordionItem value="sort">
              <AccordionTrigger>{t("sortBy")}</AccordionTrigger>
              <AccordionContent>{sortOptions}</AccordionContent>
            </AccordionItem>
            <AccordionItem value="price">
              <AccordionTrigger>{tProducts("price")}</AccordionTrigger>
              <AccordionContent>{priceOptions}</AccordionContent>
            </AccordionItem>
            {colorOptions && (
              <AccordionItem value="color">
                <AccordionTrigger>{tProducts("color")}</AccordionTrigger>
                <AccordionContent>{colorOptions}</AccordionContent>
              </AccordionItem>
            )}
          </Accordion>

          <div className="mt-4 flex gap-2 border-t pt-4">
            <Button variant="outline" className="flex-1" onClick={handleReset}>
              {t("resetFilters")}
            </Button>
            <Button className="flex-1" onClick={() => navigate({ sort, price, color })}>
              {t("applyFilters")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
