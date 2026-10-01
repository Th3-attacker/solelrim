// A page number from the URL (?page=), made safe for skip/take: "1.5",
// "-3", "abc" or "Infinity" would otherwise reach the query and make it
// throw instead of just showing a page.
export function toPageNumber(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
}
