import { addDays, endOfDay, isValid, parseISO, startOfDay } from "date-fns";

export const MAX_ORDER_DATE_RANGE_DAYS = 15;

export function parseOrderDateParam(value?: string): Date | undefined {
  if (!value) return undefined;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : undefined;
}

// A single day is just a "from"/"to" pair pointing at the same date — there's
// no separate exact-date param. The span is capped to
// MAX_ORDER_DATE_RANGE_DAYS even if the URL is edited by hand past what the
// calendar itself allows.
export function parseOrderDateFilters(params: {
  from?: string;
  to?: string;
}): { dateFrom?: Date; dateTo?: Date } {
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
