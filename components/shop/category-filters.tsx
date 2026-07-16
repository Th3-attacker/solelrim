"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { FilterPanel } from "@/components/shop/filter-panel";
import { FilterTrigger } from "@/components/shop/filter-trigger";
import { useRouter, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function CategoryFilters({
  categoryBreadcrumb,
  colors,
  categoryId,
}: {
  categoryBreadcrumb: React.ReactNode;
  colors: string[];
  categoryId?: string;
}) {
  const t = useTranslations("shop");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [panelOpen, setPanelOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
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
    setPanelOpen(false);
  }

  function handleReset() {
    setSort("default");
    setPrice("all");
    setColor("");
    navigate({ sort: "default", price: "all", color: "" });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="hidden items-center justify-between gap-4 md:flex">
        {categoryBreadcrumb}
        <FilterTrigger
          open={panelOpen}
          onToggle={() => setPanelOpen((o) => !o)}
          activeCount={activeCount}
        />
      </div>

      <div className="flex items-center justify-between gap-4 md:hidden">
        <button
          type="button"
          onClick={() => setCategoriesOpen((o) => !o)}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {t("categoriesLabel")}
          <ChevronDown
            className={cn("size-4 transition-transform", categoriesOpen && "rotate-180")}
          />
        </button>
        <FilterTrigger
          open={panelOpen}
          onToggle={() => setPanelOpen((o) => !o)}
          activeCount={activeCount}
        />
      </div>

      {categoriesOpen && (
        <div className="animate-in fade-in slide-in-from-top-2 w-full duration-200 md:hidden">
          {categoryBreadcrumb}
        </div>
      )}

      <FilterPanel
        open={panelOpen}
        colors={colors}
        sort={sort}
        price={price}
        color={color}
        onSortChange={setSort}
        onPriceChange={setPrice}
        onColorChange={setColor}
        onApply={() => navigate({ sort, price, color })}
        onReset={handleReset}
      />
    </div>
  );
}
