"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { CalendarIcon, ListFilter, Search } from "lucide-react";
import { fr, enUS, arMA } from "date-fns/locale";
import { startOfDay, subDays } from "date-fns";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
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

const STATUS_DOT_CLASS: Record<OrderStatus, string> = {
  PENDING: "bg-warning",
  CONFIRMED: "bg-success",
  SHIPPING: "bg-info",
  DELIVERED: "bg-success",
  REJECTED: "bg-destructive",
  CANCELLED: "bg-muted-foreground",
};

const STATUSES = Object.values(OrderStatus);

const CALENDAR_LOCALES: Record<string, typeof fr> = { fr, en: enUS, ar: arMA };

const SYNC_DEBOUNCE_MS = 400;
const MAX_RANGE_MS = MAX_ORDER_DATE_RANGE_DAYS * 24 * 60 * 60 * 1000;

function toDateParam(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function clampRange(range: DateRange): DateRange {
  if (!range.to || range.to.getTime() - range.from!.getTime() <= MAX_RANGE_MS) {
    return range;
  }
  return { from: range.from, to: new Date(range.from!.getTime() + MAX_RANGE_MS) };
}

// Every preset here must fit inside MAX_ORDER_DATE_RANGE_DAYS — "month to
// date" / "year to date" style presets are deliberately left out since they'd
// silently get clamped to 15 days, making their own label misleading.
const DATE_PRESETS: { labelKey: string; range: () => DateRange }[] = [
  { labelKey: "presetToday", range: () => ({ from: startOfDay(new Date()), to: startOfDay(new Date()) }) },
  {
    labelKey: "presetYesterday",
    range: () => {
      const d = startOfDay(subDays(new Date(), 1));
      return { from: d, to: d };
    },
  },
  {
    labelKey: "presetLast7Days",
    range: () => ({ from: startOfDay(subDays(new Date(), 6)), to: startOfDay(new Date()) }),
  },
  {
    labelKey: "presetLast15Days",
    range: () => ({ from: startOfDay(subDays(new Date(), 14)), to: startOfDay(new Date()) }),
  },
];

type Filters = {
  status: string;
  search: string;
  fromDate: string;
  toDate: string;
};

function readFilters(searchParams: URLSearchParams): Filters {
  return {
    status: searchParams.get("status") ?? "",
    search: searchParams.get("q") ?? "",
    fromDate: searchParams.get("from") ?? "",
    toDate: searchParams.get("to") ?? "",
  };
}

// `filters` is the single source of truth; every handler below only ever
// updates this local state. The effect further down is the ONLY call site
// that ever pushes it to the URL, so at most one router.replace() is ever in
// flight for a given burst of interaction — its cleanup cancels a
// still-pending sync whenever `filters` changes again before it fires.
export function OrderFilters() {
  const t = useTranslations("orders");
  const locale = useLocale();
  const format = useFormatter();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<Filters>(() => readFilters(searchParams));
  const [isSyncing, startSyncTransition] = useTransition();
  const isFirstRender = useRef(true);

  const [statusOpen, setStatusOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(filters.status);

  const [dateOpen, setDateOpen] = useState(false);
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>(
    filters.fromDate
      ? { from: new Date(filters.fromDate), to: filters.toDate ? new Date(filters.toDate) : undefined }
      : undefined,
  );

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const handle = setTimeout(() => {
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (filters.search) params.set("q", filters.search);
      if (filters.fromDate) params.set("from", filters.fromDate);
      if (filters.toDate) params.set("to", filters.toDate);
      const query = params.toString();
      startSyncTransition(() => {
        router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
      });
    }, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [filters, pathname, router]);

  function handleStatusOpenChange(open: boolean) {
    if (open) setPendingStatus(filters.status);
    setStatusOpen(open);
  }

  function handleApplyStatus() {
    setFilters((f) => ({ ...f, status: pendingStatus }));
    setStatusOpen(false);
  }

  function handleDateOpenChange(open: boolean) {
    if (open) {
      setPendingRange(
        filters.fromDate
          ? { from: new Date(filters.fromDate), to: filters.toDate ? new Date(filters.toDate) : undefined }
          : undefined,
      );
    }
    setDateOpen(open);
  }

  function handleApplyDate() {
    setFilters((f) => ({
      ...f,
      fromDate: pendingRange?.from ? toDateParam(pendingRange.from) : "",
      toDate: pendingRange?.to ? toDateParam(pendingRange.to) : "",
    }));
    setDateOpen(false);
  }

  function handleReset() {
    setFilters({ status: "", search: "", fromDate: "", toDate: "" });
  }

  const dateLabel =
    filters.fromDate && filters.toDate && filters.toDate !== filters.fromDate
      ? `${format.dateTime(new Date(filters.fromDate), { dateStyle: "medium" })} – ${format.dateTime(new Date(filters.toDate), { dateStyle: "medium" })}`
      : filters.fromDate
        ? format.dateTime(new Date(filters.fromDate), { dateStyle: "medium" })
        : t("date");

  const hasActiveFilters = Boolean(
    filters.status || filters.search || filters.fromDate || filters.toDate,
  );

  const today = startOfDay(new Date());

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-56 flex">
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

      <Popover open={statusOpen} onOpenChange={handleStatusOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="rounded-md">
            <ListFilter className="size-3.5 text-muted-foreground" />
            {filters.status ? t(STATUS_LABEL_KEY[filters.status as OrderStatus]) : t("status")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2">
          <div className="flex flex-col gap-0.5">
            <StatusRow
              label={t("allStatuses")}
              checked={pendingStatus === ""}
              onSelect={() => setPendingStatus("")}
            />
            <Separator className="my-1" />
            {STATUSES.map((value) => (
              <StatusRow
                key={value}
                label={t(STATUS_LABEL_KEY[value])}
                dotClassName={STATUS_DOT_CLASS[value]}
                checked={pendingStatus === value}
                onSelect={() => setPendingStatus(value)}
              />
            ))}
          </div>
          <Button size="sm" className="mt-2 w-full" onClick={handleApplyStatus}>
            {t("applyFilter")}
          </Button>
        </PopoverContent>
      </Popover>

      <Popover open={dateOpen} onOpenChange={handleDateOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="rounded-md">
            <CalendarIcon className="size-3.5 text-muted-foreground" />
            {dateLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex">
            <div className="flex w-36 flex-col gap-0.5 border-e p-2">
              {DATE_PRESETS.map((preset) => (
                <button
                  key={preset.labelKey}
                  type="button"
                  onClick={() => setPendingRange(clampRange(preset.range()))}
                  className="rounded-md px-2 py-1.5 text-start text-sm hover:bg-muted"
                >
                  {t(preset.labelKey)}
                </button>
              ))}
            </div>
            <Calendar
              mode="range"
              locale={CALENDAR_LOCALES[locale] ?? enUS}
              selected={pendingRange}
              onSelect={(range) => setPendingRange(range && clampRange(range))}
              disabled={(date) => {
                if (date > today) return true;
                if (pendingRange?.from && !pendingRange.to) {
                  return Math.abs(date.getTime() - pendingRange.from.getTime()) > MAX_RANGE_MS;
                }
                return false;
              }}
            />
          </div>
          <div className="flex items-center justify-between border-t px-3 py-2">
            <span className="text-xs text-muted-foreground">{t("dateRangeHint")}</span>
            <Button size="sm" onClick={handleApplyDate}>
              {t("applyFilter")}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={handleReset}>
          {t("resetFilters")}
        </Button>
      )}
    </div>
  );
}

function StatusRow({
  label,
  dotClassName,
  checked,
  onSelect,
}: {
  label: string;
  dotClassName?: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm hover:bg-muted"
    >
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-full border",
          checked ? "border-primary" : "border-input",
        )}
      >
        {checked && <span className="size-2 rounded-full bg-primary" />}
      </span>
      {dotClassName && <span className={cn("size-2 shrink-0 rounded-full", dotClassName)} />}
      {label}
    </button>
  );
}
