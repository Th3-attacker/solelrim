"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SYNC_DEBOUNCE_MS = 400;
const ALL_CATEGORIES = "__all__";

type Filters = { search: string; categoryId: string };

function readFilters(searchParams: URLSearchParams): Filters {
  return {
    search: searchParams.get("q") ?? "",
    categoryId: searchParams.get("category") ?? "",
  };
}

// Mirrors OrderFilters' debounced-URL-sync pattern (components/orders/order-filters.tsx),
// scaled down to just search + category — no date range/status needed here.
export function ProductFilters({
  categories,
}: {
  categories: { id: string; name: string }[];
}) {
  const t = useTranslations("products");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<Filters>(() => readFilters(searchParams));
  const [isSyncing, startSyncTransition] = useTransition();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const handle = setTimeout(() => {
      const params = new URLSearchParams();
      if (filters.search) params.set("q", filters.search);
      if (filters.categoryId) params.set("category", filters.categoryId);
      const query = params.toString();
      startSyncTransition(() => {
        router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
      });
    }, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [filters, pathname, router]);

  const hasActiveFilters = Boolean(filters.search || filters.categoryId);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex min-w-56">
        {isSyncing ? (
          <Spinner className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        ) : (
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        )}
        <Input
          aria-label={t("searchPlaceholder")}
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          placeholder={t("searchPlaceholder")}
          className="rounded-md ps-9"
        />
      </div>

      <Select
        value={filters.categoryId || ALL_CATEGORIES}
        onValueChange={(value) =>
          setFilters((f) => ({ ...f, categoryId: value === ALL_CATEGORIES ? "" : value }))
        }
      >
        <SelectTrigger size="sm" className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_CATEGORIES}>{t("allCategories")}</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {category.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setFilters({ search: "", categoryId: "" })}
        >
          {tCommon("resetFilters")}
        </Button>
      )}
    </div>
  );
}
