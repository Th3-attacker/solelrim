"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { OrderStatus } from "@/lib/generated/prisma/enums";
import { MAX_ORDER_DATE_RANGE_DAYS } from "@/lib/orders/filters";

const STATUS_LABEL_KEY: Record<OrderStatus, string> = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  SHIPPING: "shipping",
  DELIVERED: "delivered",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
};

const STATUSES = Object.values(OrderStatus);

const SYNC_DEBOUNCE_MS = 400;
const MAX_RANGE_MS = MAX_ORDER_DATE_RANGE_DAYS * 24 * 60 * 60 * 1000;

type DateMode = "range" | "exact";

type Filters = {
  status: string;
  search: string;
  exactDate: string;
  fromDate: string;
  toDate: string;
};

function readFilters(searchParams: URLSearchParams): Filters {
  return {
    status: searchParams.get("status") ?? "",
    search: searchParams.get("q") ?? "",
    exactDate: searchParams.get("date") ?? "",
    fromDate: searchParams.get("from") ?? "",
    toDate: searchParams.get("to") ?? "",
  };
}

// `filters` is the single source of truth; every handler below only ever
// updates this local state. The effect further down is the ONLY call site
// that ever pushes it to the URL. Routing every change (including Reset)
// through that one debounced effect means at most one router.replace() is
// ever in flight for a given burst of interaction — its cleanup cancels a
// still-pending sync whenever `filters` changes again before it fires. Two
// independent replace() calls (e.g. one from Reset, one from a debounced
// search update moments later) can resolve out of order and the earlier one
// can stomp the later one once it finally lands; a single call site makes
// that impossible.
export function OrderFilters() {
  const t = useTranslations("orders");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<Filters>(() => readFilters(searchParams));
  const [dateMode, setDateMode] = useState<DateMode>(() =>
    filters.exactDate ? "exact" : "range",
  );
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const handle = setTimeout(() => {
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (filters.search) params.set("q", filters.search);
      if (filters.exactDate) params.set("date", filters.exactDate);
      if (filters.fromDate) params.set("from", filters.fromDate);
      if (filters.toDate) params.set("to", filters.toDate);
      const query = params.toString();
      router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
    }, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [filters, pathname, router]);

  function handleStatusChange(value: string) {
    setFilters((f) => ({ ...f, status: value === "all" ? "" : value }));
  }

  function handleDateModeChange(value: string) {
    if (!value) return;
    const mode = value as DateMode;
    setDateMode(mode);
    setFilters((f) =>
      mode === "exact" ? { ...f, fromDate: "", toDate: "" } : { ...f, exactDate: "" },
    );
  }

  function handleExactDateChange(value: string) {
    setFilters((f) => ({ ...f, exactDate: value, fromDate: "", toDate: "" }));
  }

  function handleFromChange(value: string) {
    setFilters((f) => {
      let toDate = f.toDate;
      // Clamp an already-picked "to" that would now exceed the 15-day cap,
      // so the visible filter matches what the server will actually apply.
      if (
        value &&
        toDate &&
        new Date(toDate).getTime() - new Date(value).getTime() > MAX_RANGE_MS
      ) {
        toDate = new Date(new Date(value).getTime() + MAX_RANGE_MS)
          .toISOString()
          .slice(0, 10);
      }
      return { ...f, exactDate: "", fromDate: value, toDate };
    });
  }

  function handleToChange(value: string) {
    setFilters((f) => {
      // The native `max` attribute keeps a picker from going past the cap,
      // but a typed/pasted value can still bypass it — clamp defensively.
      let toDate = value;
      if (
        f.fromDate &&
        toDate &&
        new Date(toDate).getTime() - new Date(f.fromDate).getTime() > MAX_RANGE_MS
      ) {
        toDate = new Date(new Date(f.fromDate).getTime() + MAX_RANGE_MS)
          .toISOString()
          .slice(0, 10);
      }
      return { ...f, exactDate: "", toDate };
    });
  }

  function handleReset() {
    setDateMode("range");
    setFilters({ status: "", search: "", exactDate: "", fromDate: "", toDate: "" });
  }

  const maxTo = filters.fromDate
    ? new Date(new Date(filters.fromDate).getTime() + MAX_RANGE_MS)
        .toISOString()
        .slice(0, 10)
    : undefined;

  const hasActiveFilters = Boolean(
    filters.status ||
      filters.search ||
      filters.exactDate ||
      filters.fromDate ||
      filters.toDate,
  );

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="order-status-filter">{t("status")}</Label>
        <Select value={filters.status || "all"} onValueChange={handleStatusChange}>
          <SelectTrigger id="order-status-filter" size="sm" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatuses")}</SelectItem>
            {STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(STATUS_LABEL_KEY[value])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="order-search-filter">{t("searchPlaceholder")}</Label>
        <Input
          id="order-search-filter"
          value={filters.search}
          onChange={(e) =>
            setFilters((f) => ({ ...f, search: e.target.value }))
          }
          placeholder={t("searchPlaceholder")}
          className="h-9 w-56"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>{t("date")}</Label>
        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={dateMode}
            onValueChange={handleDateModeChange}
          >
            <ToggleGroupItem value="range">{t("dateModeRange")}</ToggleGroupItem>
            <ToggleGroupItem value="exact">{t("dateModeExact")}</ToggleGroupItem>
          </ToggleGroup>

          {dateMode === "exact" ? (
            <Input
              type="date"
              value={filters.exactDate}
              onChange={(e) => handleExactDateChange(e.target.value)}
              className="h-9 w-40"
              aria-label={t("dateModeExact")}
            />
          ) : (
            <>
              <Input
                type="date"
                value={filters.fromDate}
                onChange={(e) => handleFromChange(e.target.value)}
                className="h-9 w-36"
                aria-label={t("dateFrom")}
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="date"
                value={filters.toDate}
                min={filters.fromDate || undefined}
                max={maxTo}
                onChange={(e) => handleToChange(e.target.value)}
                className="h-9 w-36"
                aria-label={t("dateTo")}
              />
            </>
          )}
        </div>
        {dateMode === "range" && (
          <span className="text-xs text-muted-foreground">{t("dateRangeHint")}</span>
        )}
      </div>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={handleReset}>
          {t("resetFilters")}
        </Button>
      )}
    </div>
  );
}
