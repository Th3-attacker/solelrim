import { useEffect, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { Link } from "@tanstack/react-router";
import { useFormatter, useTranslations } from "use-intl";
import { formatPriceNumber } from "@/lib/format/currency";
import { toCsv } from "@/lib/shop/csv";
import { cn } from "~/lib/cn";
import { Button, ButtonLink } from "~/components/ui/button";
import { Input } from "~/components/ui/field";
import { Icon } from "~/components/ui/icon";
import { Status } from "~/components/ui/status";
import { notify } from "~/components/ui/toast";
import type { Locale } from "~/i18n/config";
import { DATE_PRESETS, matchPreset, presetRange } from "./date-presets";
import { ORDER_STATUS } from "./order-status";
import { exportOrders } from "./orders.functions";
import { ORDER_TABS, type OrderListSearch, type OrderTab } from "./orders.schemas";

export type OrderRow = {
  id: string;
  reference: string;
  customerName: string;
  customerPhone: string;
  total: number;
  status: keyof typeof ORDER_STATUS;
  createdAt: Date;
};

const TAB_LABEL = {
  all: "tabAll",
  pending: "tabPending",
  confirmed: "tabConfirmed",
  shipping: "tabShipping",
  delivered: "tabDelivered",
  rejected: "tabRejected",
  cancelled: "tabCancelled",
} as const satisfies Record<OrderTab, string>;

// The status tabs: links, so each can be opened in a new tab and the back
// button walks through them. The count says how many each holds.
export function StatusTabs({
  locale,
  current,
  counts,
}: {
  locale: Locale;
  current: OrderTab;
  counts: Record<OrderTab, number>;
}) {
  const t = useTranslations("orders");
  return (
    <nav aria-label={t("statusTabsLabel")} className="max-w-full overflow-x-auto">
      <ul className="flex w-max gap-0.5 rounded-[11px] bg-tile p-[3px]">
        {ORDER_TABS.map((tab) => (
          <li key={tab}>
            <Link
              to="/$locale/admin/orders"
              params={{ locale }}
              search={(prev) => ({ ...prev, status: tab, page: 1 })}
              aria-current={tab === current ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-[9px] px-3 text-[13px] font-semibold whitespace-nowrap text-muted no-underline hover:text-ink",
                tab === current &&
                  "bg-surface text-brand shadow-[0_1px_3px_rgb(15_23_42/0.12)] hover:text-brand",
              )}
            >
              {t(TAB_LABEL[tab])}
              {counts[tab] > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[11px] font-bold tabular-nums",
                    tab === current ? "bg-tint text-brand" : "bg-surface-2 text-ink-2",
                  )}
                >
                  <span aria-hidden="true">{counts[tab]}</span>
                  <span className="sr-only">{t("tabCountLabel", { count: counts[tab] })}</span>
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// Phone or reference, applied as the admin types (after a short pause).
export function OrderSearch({
  value,
  onSearch,
}: {
  value: string | undefined;
  onSearch: (q: string | undefined) => void;
}) {
  const t = useTranslations("orders");
  const [text, setText] = useState(value ?? "");

  // The back button or a reset changed the address: follow it (but not the
  // echo of what is being typed).
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    setShown(value);
    if ((value ?? "") !== text.trim()) setText(value ?? "");
  }

  useEffect(() => {
    const q = text.trim() || undefined;
    if (q === value) return;
    const timer = setTimeout(() => onSearch(q), 300);
    return () => clearTimeout(timer);
  }, [text, value, onSearch]);

  return (
    <search className="w-full sm:w-64">
      <Input
        type="search"
        aria-label={t("searchLabel")}
        placeholder={t("searchShortPlaceholder")}
        value={text}
        onChange={(event) => setText(event.target.value)}
        leading={<Icon name="search" className="text-muted" />}
        className="h-10"
      />
    </search>
  );
}

// All dates, a shortcut (today, yesterday, 7 or 15 days), or a range of at
// most 15 days.
export function DateFilter({
  from,
  to,
  now,
  onChange,
}: {
  from?: string;
  to?: string;
  now: Date;
  onChange: (range: { from?: string; to?: string }) => void;
}) {
  const t = useTranslations("orders");
  const format = useFormatter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ from: from ?? "", to: to ?? "" });
  const preset = matchPreset({ from, to }, now);
  const presetKey = {
    today: "presetToday",
    yesterday: "presetYesterday",
    last7Days: "presetLast7Days",
    last15Days: "presetLast15Days",
  } as const;
  const day = (value: string) =>
    format.dateTime(new Date(`${value}T00:00:00Z`), { day: "numeric", month: "short" });

  const label = preset
    ? t(presetKey[preset])
    : from && to
      ? t("dateRangeShown", { from: day(from), to: day(to) })
      : t("dateFilterAll");

  const pick = (range: { from?: string; to?: string }) => {
    onChange(range);
    setOpen(false);
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDraft({ from: from ?? "", to: to ?? "" });
      }}
    >
      <Popover.Trigger render={<Button />}>
        <Icon name="calendar" />
        <span className="sr-only">{t("dateFilterLabel")}</span>
        {label}
        <Icon name="chevronDown" className="size-3.5 text-muted" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} align="end" className="z-50">
          <Popover.Popup className="flex w-72 flex-col gap-1 rounded-xl border border-line bg-surface p-1.5 shadow-pop outline-none">
            <Popover.Title className="sr-only">{t("dateFilterLabel")}</Popover.Title>
            {[undefined, ...DATE_PRESETS].map((option) => {
              const selected = option ? preset === option : !from && !to;
              return (
                <button
                  key={option ?? "all"}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => pick(option ? presetRange(option, now) : {})}
                  className="flex h-9 items-center justify-between rounded-lg px-2.5 text-start text-[14px] hover:bg-tile aria-pressed:font-semibold aria-pressed:text-brand"
                >
                  {option ? t(presetKey[option]) : t("dateFilterAll")}
                  {selected && <Icon name="check" className="size-4" />}
                </button>
              );
            })}
            <form
              className="mt-1 flex flex-col gap-2 border-t border-line-soft px-1 pt-2.5 pb-1"
              onSubmit={(event) => {
                event.preventDefault();
                if (draft.from && draft.to) pick({ from: draft.from, to: draft.to });
              }}
            >
              <p className="text-label text-muted uppercase">{t("dateFilterCustom")}</p>
              <div className="grid grid-cols-2 gap-2">
                {(["from", "to"] as const).map((edge) => (
                  <label key={edge} className="flex flex-col gap-1 text-[12px] font-semibold">
                    {t(edge === "from" ? "dateFrom" : "dateTo")}
                    <Input
                      type="date"
                      required
                      value={draft[edge]}
                      max={now.toISOString().slice(0, 10)}
                      onChange={(event) =>
                        setDraft((range) => ({ ...range, [edge]: event.target.value }))
                      }
                      className="h-9 px-2 text-[13px]"
                    />
                  </label>
                ))}
              </div>
              <p className="text-[12px] text-muted">{t("dateRangeHint")}</p>
              <Button type="submit" variant="primary" size="sm">
                {t("applyFilter")}
              </Button>
            </form>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

// A CSV of every order the filters match, or of the ticked ones. Read when
// asked, not with every page of the list.
export function useOrdersCsv() {
  const t = useTranslations("orders");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const [busy, setBusy] = useState(false);

  async function download(input: { ids: string[] } | Omit<OrderListSearch, "page">) {
    setBusy(true);
    try {
      const rows = await exportOrders({ data: input });
      const csv = toCsv(
        [
          { key: "reference", label: t("reference") },
          { key: "customer", label: t("customer") },
          { key: "phone", label: t("phone") },
          { key: "city", label: t("city") },
          { key: "paymentSenderPhone", label: t("paymentSenderPhone") },
          { key: "total", label: t("total") },
          { key: "status", label: t("status") },
          { key: "date", label: t("date") },
        ],
        rows.map((row) => ({
          reference: row.reference,
          customer: row.customerName,
          phone: row.customerPhone,
          city: row.customerCity,
          paymentSenderPhone: row.paymentSenderPhone ?? "",
          total: `${formatPriceNumber(row.total)} ${tCommon("currency")}`,
          status: t(ORDER_STATUS[row.status].label),
          date: format.dateTime(row.createdAt, { dateStyle: "medium" }),
        })),
      );
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = Object.assign(document.createElement("a"), {
        href: url,
        download: `commandes-${new Date().toISOString().slice(0, 10)}.csv`,
      });
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      notify({ tone: "error", title: tCommon("error") });
    } finally {
      setBusy(false);
    }
  }

  return { download, busy };
}

// How long a payment has waited, in orange once it is overdue.
export function PendingAge({
  createdAt,
  now,
  staleAfterHours,
}: {
  createdAt: Date;
  now: Date;
  staleAfterHours: number;
}) {
  const format = useFormatter();
  const stale = now.getTime() - createdAt.getTime() >= staleAfterHours * 3_600_000;
  return (
    <span className={cn("block text-[12px]", stale ? "font-semibold text-warn-ink" : "text-muted")}>
      {format.relativeTime(createdAt, now)}
    </span>
  );
}

// Phones: each order as a card, the whole card a link to it.
export function OrderCards({
  rows,
  locale,
  now,
  staleAfterHours,
}: {
  rows: OrderRow[];
  locale: Locale;
  now: Date;
  staleAfterHours: number;
}) {
  const t = useTranslations("orders");
  const currency = useTranslations("common")("currency");
  return (
    <ul className="flex flex-col gap-2.5 p-3 md:hidden">
      {rows.map((order) => {
        const status = ORDER_STATUS[order.status];
        return (
          <li key={order.id}>
            <Link
              to="/$locale/admin/orders/$orderId"
              params={{ locale, orderId: order.id }}
              className="flex flex-col gap-2 rounded-card border border-line bg-surface p-3.5 text-ink no-underline hover:text-ink"
            >
              <span className="flex items-center justify-between gap-3 text-[15px] font-bold">
                <span className="truncate">{order.customerName}</span>
                <span className="tabular-nums">
                  {formatPriceNumber(order.total)} {currency}
                </span>
              </span>
              <span className="flex items-center justify-between gap-3 text-[12px] text-muted">
                <span dir="ltr" className="truncate">
                  {order.reference} · {order.customerPhone}
                </span>
                <Status tone={status.tone}>{t(status.label)}</Status>
              </span>
              {order.status === "PENDING" && (
                <PendingAge
                  createdAt={order.createdAt}
                  now={now}
                  staleAfterHours={staleAfterHours}
                />
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function SelectionActions({
  selected,
  locale,
  onClear,
}: {
  selected: OrderRow[];
  locale: Locale;
  onClear: () => void;
}) {
  const t = useTranslations("orders");
  const tTable = useTranslations("admin.table");
  const csv = useOrdersCsv();
  const ids = selected.map((order) => order.id);
  const onBrand =
    "border border-white/30 bg-transparent text-on-brand hover:bg-white/10 hover:text-on-brand";

  return (
    <>
      <b aria-live="polite">{tTable("selectedRowsCount", { count: selected.length })}</b>
      <span className="flex-1" />
      <Button
        size="sm"
        className={onBrand}
        busy={csv.busy}
        onClick={() => void csv.download({ ids })}
      >
        <Icon name="download" className="size-4" />
        {t("exportSelection")}
      </Button>
      <ButtonLink
        size="sm"
        className={onBrand}
        to="/$locale/admin/orders/labels"
        params={{ locale }}
        search={{ ids }}
      >
        <Icon name="print" className="size-4" />
        {t("printSelectedLabels")}
      </ButtonLink>
      <Button size="sm" variant="secondary" onClick={onClear}>
        {tTable("clearSelection")}
      </Button>
    </>
  );
}
