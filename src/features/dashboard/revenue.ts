// The revenue chart's bars: days, weeks or months, depending on how long a
// stretch the period covers, every bucket present even when nothing sold.

export const REVENUE_PERIODS = ["all", "3m", "30d", "7d"] as const;
export type RevenuePeriod = (typeof REVENUE_PERIODS)[number];
export type BucketUnit = "day" | "week" | "month";

export type RevenueBucket = {
  // First day of the bucket, "YYYY-MM-DD" (UTC: Nouakchott's own time).
  start: string;
  total: number;
};

const DAY_MS = 86_400_000;
const toDay = (date: Date) => date.toISOString().slice(0, 10);
const parseDay = (day: string) => new Date(`${day}T00:00:00Z`);

// Monday of the week holding `date`.
function weekStart(date: Date): Date {
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return monday;
}

function monthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function next(date: Date, unit: BucketUnit): Date {
  const following = new Date(date);
  if (unit === "day") following.setUTCDate(date.getUTCDate() + 1);
  if (unit === "week") following.setUTCDate(date.getUTCDate() + 7);
  if (unit === "month") following.setUTCMonth(date.getUTCMonth() + 1);
  return following;
}

function align(date: Date, unit: BucketUnit): Date {
  return unit === "day" ? date : unit === "week" ? weekStart(date) : monthStart(date);
}

// First day the period covers. "All" starts at the first sale (today when
// nothing sold yet).
export function periodStart(period: RevenuePeriod, today: string, firstSale?: string): string {
  const end = parseDay(today);
  if (period === "7d") return toDay(new Date(end.getTime() - 6 * DAY_MS));
  if (period === "30d") return toDay(new Date(end.getTime() - 29 * DAY_MS));
  if (period === "3m") {
    const start = new Date(end);
    start.setUTCMonth(end.getUTCMonth() - 3);
    return toDay(new Date(start.getTime() + DAY_MS));
  }
  return firstSale && firstSale < today ? firstSale : today;
}

// Up to a month of days reads well as bars; beyond, weeks; past half a
// year, months.
export function bucketUnit(from: string, to: string): BucketUnit {
  const days = Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / DAY_MS) + 1;
  if (days <= 31) return "day";
  if (days <= 182) return "week";
  return "month";
}

// `days` is the revenue per day that had sales (any order).
export function bucketRevenue(
  days: ReadonlyArray<{ day: string; total: number }>,
  from: string,
  to: string,
): { unit: BucketUnit; buckets: RevenueBucket[] } {
  const unit = bucketUnit(from, to);
  const totals = new Map<string, number>();
  for (const { day, total } of days) {
    if (day < from || day > to) continue;
    const key = toDay(align(parseDay(day), unit));
    totals.set(key, (totals.get(key) ?? 0) + total);
  }

  const buckets: RevenueBucket[] = [];
  const end = parseDay(to);
  for (let cursor = align(parseDay(from), unit); cursor <= end; cursor = next(cursor, unit)) {
    const start = toDay(cursor);
    buckets.push({ start, total: Math.round((totals.get(start) ?? 0) * 100) / 100 });
  }
  return { unit, buckets };
}
