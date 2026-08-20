// Compact, URL-safe encoding for a "share cart" link's query string — cuids
// are already alphanumeric, so no escaping is needed beyond the usual
// URLSearchParams handling of the whole value.
export function encodeCartEntries(items: { variantId: string; quantity: number }[]): string {
  return items.map((i) => `${i.variantId}:${i.quantity}`).join(",");
}

export function decodeCartEntries(raw: string): { variantId: string; quantity: number }[] {
  return raw
    .split(",")
    .map((pair) => {
      const [variantId, quantityRaw] = pair.split(":");
      const quantity = Number(quantityRaw);
      if (!variantId || !Number.isInteger(quantity) || quantity < 1) return null;
      return { variantId, quantity };
    })
    .filter((entry): entry is { variantId: string; quantity: number } => entry !== null);
}
