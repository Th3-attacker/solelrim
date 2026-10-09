// Sizes are free text, so a plain text sort puts L before M before S. This
// puts letter sizes in wearing order (XXS…XXXL), then numeric sizes (shoe
// sizes, waist…) by value, then anything else (TU, 6 ans, 50ml…) in the order
// it was entered. Shared by the website's picker and the mobile API so both
// list sizes the same way.
const LETTER_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const LETTER_ALIASES: Record<string, string> = { "2XL": "XXL", "3XL": "XXXL", "2XS": "XXS" };

function letterRank(size: string): number {
  const key = size.trim().toUpperCase();
  return LETTER_SIZES.indexOf(LETTER_ALIASES[key] ?? key);
}

function numericValue(size: string): number | null {
  const match = /^\d+(?:[.,]\d+)?$/.exec(size.trim());
  return match ? Number(match[0].replace(",", ".")) : null;
}

/** Sorts items by their size; ties (and unknown sizes) keep their input order. */
export function sortBySize<T>(items: readonly T[], getSize: (item: T) => string): T[] {
  return items
    .map((item, index) => ({ item, index, size: getSize(item) }))
    .sort((a, b) => compareSizes(a.size, b.size) || a.index - b.index)
    .map(({ item }) => item);
}

function compareSizes(a: string, b: string): number {
  const group = (size: string) =>
    letterRank(size) >= 0 ? 0 : numericValue(size) !== null ? 1 : 2;
  const ga = group(a);
  const gb = group(b);
  if (ga !== gb) return ga - gb;
  if (ga === 0) return letterRank(a) - letterRank(b);
  if (ga === 1) return numericValue(a)! - numericValue(b)!;
  return 0;
}
