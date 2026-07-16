"use client";

import { useTranslations } from "next-intl";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
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

export function FilterPanel({
  open,
  colors,
  sort,
  price,
  color,
  onSortChange,
  onPriceChange,
  onColorChange,
  onApply,
  onReset,
}: {
  open: boolean;
  colors: string[];
  sort: string;
  price: string;
  color: string;
  onSortChange: (value: string) => void;
  onPriceChange: (value: string) => void;
  onColorChange: (value: string) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  const t = useTranslations("shop");
  const tProducts = useTranslations("products");
  const tCommon = useTranslations("common");

  if (!open) return null;

  const sortOptions = (
    <div className="flex flex-col gap-1">
      {SORT_OPTIONS.map((option) => (
        <OptionButton
          key={option.value}
          active={sort === option.value}
          onClick={() => onSortChange(option.value)}
        >
          {t(option.labelKey)}
        </OptionButton>
      ))}
    </div>
  );

  const priceOptions = (
    <div className="flex flex-col gap-1">
      <OptionButton active={price === "all"} onClick={() => onPriceChange("all")}>
        {t("allCategories")}
      </OptionButton>
      {PRICE_BUCKETS.map((bucket) => (
        <OptionButton
          key={bucket.value}
          active={price === bucket.value}
          onClick={() => onPriceChange(bucket.value)}
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
            onClick={() => onColorChange(color === c ? "" : c)}
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
    <div className="animate-in fade-in slide-in-from-top-2 w-full rounded-lg border p-4 duration-200">
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
        <Button variant="outline" className="flex-1" onClick={onReset}>
          {t("resetFilters")}
        </Button>
        <Button className="flex-1" onClick={onApply}>
          {t("applyFilters")}
        </Button>
      </div>
    </div>
  );
}
