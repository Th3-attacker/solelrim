// The date filter's shortcuts, as the "from"/"to" days of the address.
// Days are Nouakchott's, which is UTC all year: no offset to apply.
export const DATE_PRESETS = ["today", "yesterday", "last7Days", "last15Days"] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];

const DAY_MS = 86_400_000;
const toDay = (time: number) => new Date(time).toISOString().slice(0, 10);

export function presetRange(preset: DatePreset, now: Date): { from: string; to: string } {
  const today = Date.parse(now.toISOString().slice(0, 10));
  switch (preset) {
    case "today":
      return { from: toDay(today), to: toDay(today) };
    case "yesterday":
      return { from: toDay(today - DAY_MS), to: toDay(today - DAY_MS) };
    case "last7Days":
      return { from: toDay(today - 6 * DAY_MS), to: toDay(today) };
    case "last15Days":
      return { from: toDay(today - 14 * DAY_MS), to: toDay(today) };
  }
}

// The preset a range is, if any: the filter button then names it.
export function matchPreset(range: { from?: string; to?: string }, now: Date): DatePreset | null {
  return (
    DATE_PRESETS.find((preset) => {
      const candidate = presetRange(preset, now);
      return candidate.from === range.from && candidate.to === range.to;
    }) ?? null
  );
}
