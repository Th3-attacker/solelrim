const DIACRITIC_REGEX = /\p{Diacritic}/gu;

// Strips accents so "peniche" also matches "pénichè" — needed for a
// French-language catalog where customers often type without accents.
export function normalizeSearchText(value: string): string {
  return value.normalize("NFD").replace(DIACRITIC_REGEX, "").toLowerCase();
}

export function matchesSearch(haystack: string, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query).trim();
  if (!normalizedQuery) return false;
  return normalizeSearchText(haystack).includes(normalizedQuery);
}
