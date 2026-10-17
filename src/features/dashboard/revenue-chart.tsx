import { useId, useState, type KeyboardEvent } from "react";
import { useFormatter, useLocale, useTranslations } from "use-intl";
import { cn } from "~/lib/cn";
import { formatPriceNumber } from "@/lib/format/currency";
import type { BucketUnit, RevenueBucket } from "./revenue";

// A clean scale: steps of 1, 2, 2.5 or 5 times a power of ten, at most
// five of them, the top the first step at or above the highest value.
export function niceScale(value: number): { top: number; step: number } {
  if (value <= 0) return { top: 1, step: 1 };
  const power = 10 ** Math.floor(Math.log10(value / 5));
  for (const base of [1, 2, 2.5, 5, 10, 20]) {
    const step = base * power;
    const count = Math.ceil(value / step);
    if (count <= 5) return { top: count * step, step };
  }
  return { top: value, step: value };
}

// "6,6 k" on the bar, the full amount in the tooltip and the table.
function compact(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(
    value,
  );
}

// Revenue per day, week or month, as columns. One series: no legend, the
// title says what it is. The best bucket carries its value and the brand
// color; the others a lighter step of it. The plot is one tab stop: arrow
// keys move from bar to bar and read each value out, like hovering does.
// Every figure is also in the table under the chart.
export function RevenueChart({
  buckets,
  unit,
  bestStart,
}: {
  buckets: RevenueBucket[];
  unit: BucketUnit;
  bestStart: string | null;
}) {
  const t = useTranslations("dashboard");
  const currency = useTranslations("common")("currency");
  const locale = useLocale();
  const format = useFormatter();
  const tableId = useId();
  const [active, setActive] = useState<number | null>(null);

  const { top, step } = niceScale(Math.max(...buckets.map((bucket) => bucket.total), 0));
  const ticks = Array.from(
    { length: Math.round(top / step) + 1 },
    (_, index) => top - index * step,
  );
  // Never more than about eight dates under the axis.
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 8));

  const label = (start: string) => {
    const date = new Date(`${start}T00:00:00Z`);
    if (unit === "month") return format.dateTime(date, { month: "short", year: "2-digit" });
    const day = format.dateTime(date, { day: "numeric", month: "short" });
    return unit === "week" ? t("weekOf", { date: day }) : day;
  };
  const amount = (value: number) => `${formatPriceNumber(value)} ${currency}`;
  const first = buckets[0];
  const last = buckets.at(-1);
  const current = active === null ? null : buckets[active];

  const onKeyDown = (event: KeyboardEvent) => {
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const backward = rtl ? "ArrowRight" : "ArrowLeft";
    if (![forward, backward, "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    setActive((index) => {
      if (event.key === "Home") return 0;
      if (event.key === "End") return buckets.length - 1;
      const from = index ?? (event.key === forward ? -1 : buckets.length);
      return Math.min(buckets.length - 1, Math.max(0, from + (event.key === forward ? 1 : -1)));
    });
  };

  return (
    <div>
      <div className="relative ps-12">
        {/* Scale: hairlines and round values, recessive. */}
        <div
          aria-hidden="true"
          className="absolute inset-y-0 start-0 end-0 flex flex-col justify-between pb-6"
        >
          {ticks.map((tick) => (
            <div key={tick} className="flex items-center gap-2">
              <span className="w-10 text-end text-[11px] text-muted tabular-nums">
                {compact(tick, locale)}
              </span>
              <span className="h-px flex-1 bg-line-soft" />
            </div>
          ))}
        </div>

        <div
          role="group"
          tabIndex={0}
          aria-roledescription={t("revenueChartRole")}
          aria-label={
            first && last
              ? t("revenueChartLabel", { from: label(first.start), to: label(last.start) })
              : undefined
          }
          aria-describedby={tableId}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
          onPointerLeave={() => setActive(null)}
          className="relative flex h-56 items-end gap-0.5 rounded-control pb-6 focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          {buckets.map((bucket, index) => {
            const best = bucket.start === bestStart;
            const height = (bucket.total / top) * 100;
            return (
              <div
                key={bucket.start}
                onPointerEnter={() => setActive(index)}
                className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end"
              >
                {best && (
                  <span className="mb-1 text-[11px] font-semibold text-ink tabular-nums">
                    {compact(bucket.total, locale)}
                  </span>
                )}
                <span
                  aria-hidden="true"
                  style={{ height: bucket.total > 0 ? `${height}%` : undefined }}
                  className={cn(
                    "block w-full max-w-6 rounded-t-[4px] transition-[height,opacity] duration-300",
                    bucket.total > 0
                      ? best
                        ? "bg-brand"
                        : "bg-brand-2"
                      : "h-0.5 rounded-none bg-line",
                    active !== null && active !== index && "opacity-60",
                  )}
                />
                {index % labelEvery === 0 && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute -bottom-0.5 translate-y-full truncate text-[11px] whitespace-nowrap text-muted",
                      // On a phone, every other date: they'd overlap.
                      (index / labelEvery) % 2 === 1 && "max-sm:hidden",
                    )}
                  >
                    {label(bucket.start)}
                  </span>
                )}
              </div>
            );
          })}

          {current && (
            <div
              role="status"
              className="pointer-events-none absolute top-0 end-0 rounded-lg border border-line bg-surface px-3 py-2 shadow-pop"
            >
              <p className="text-[14px] font-bold tabular-nums">{amount(current.total)}</p>
              <p className="text-[12px] text-muted">{label(current.start)}</p>
            </div>
          )}
        </div>
      </div>

      <details className="mt-6 text-[13px]">
        <summary className="cursor-pointer font-semibold text-brand">
          {t("revenueDataToggle")}
        </summary>
        <table id={tableId} className="mt-2 w-full max-w-md border-collapse tabular-nums">
          <thead>
            <tr>
              <th
                scope="col"
                className="border-b border-line-soft py-1.5 text-start font-medium text-muted"
              >
                {t("revenuePeriodColumn")}
              </th>
              <th
                scope="col"
                className="border-b border-line-soft py-1.5 text-end font-medium text-muted"
              >
                {t("revenue")}
              </th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((bucket) => (
              <tr key={bucket.start}>
                <th scope="row" className="border-b border-line-soft py-1.5 text-start font-normal">
                  {label(bucket.start)}
                </th>
                <td className="border-b border-line-soft py-1.5 text-end">
                  {amount(bucket.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
