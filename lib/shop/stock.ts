export type StockStatus = "in" | "low" | "out";

export function getVariantStockStatus(
  stock: number,
  lowStockThreshold: number,
): StockStatus {
  if (stock <= 0) return "out";
  if (stock <= lowStockThreshold) return "low";
  return "in";
}

export function getAggregateStockStatus(
  variants: { stock: number; lowStockThreshold: number }[],
): StockStatus {
  if (variants.length === 0) return "out";
  const statuses = variants.map((v) =>
    getVariantStockStatus(v.stock, v.lowStockThreshold),
  );
  if (statuses.every((s) => s === "out")) return "out";
  if (statuses.some((s) => s === "in")) return "in";
  return "low";
}
