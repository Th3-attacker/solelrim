import { addDays, endOfDay, isValid, parseISO, startOfDay } from "date-fns";

export const MAX_ORDER_DATE_RANGE_DAYS = 15;

export function parseOrderDateParam(value?: string): Date | undefined {
  if (!value) return undefined;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : undefined;
}

// "date" (exact day) takes priority over "from"/"to" (range). In range mode,
// the span is capped to MAX_ORDER_DATE_RANGE_DAYS even if the URL is edited
// by hand past what the UI allows.
export function parseOrderDateFilters(params: {
  date?: string;
  from?: string;
  to?: string;
}): { dateFrom?: Date; dateTo?: Date } {
  const exact = parseOrderDateParam(params.date);
  if (exact) {
    return { dateFrom: startOfDay(exact), dateTo: endOfDay(exact) };
  }

  const from = parseOrderDateParam(params.from);
  const to = parseOrderDateParam(params.to);
  if (!from && !to) return {};

  const dateFrom = from ? startOfDay(from) : undefined;
  let dateTo = to ? endOfDay(to) : undefined;
  if (dateFrom && dateTo) {
    const maxTo = endOfDay(addDays(dateFrom, MAX_ORDER_DATE_RANGE_DAYS));
    if (dateTo > maxTo) dateTo = maxTo;
  }
  return { dateFrom, dateTo };
}
