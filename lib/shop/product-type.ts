export type ProductType = "sport" | "cosmetique";

export const PRODUCT_TYPES: ProductType[] = ["sport", "cosmetique"];

export const DEFAULT_PRODUCT_TYPE: ProductType = "sport";

export function isProductType(value: string): value is ProductType {
  return PRODUCT_TYPES.includes(value as ProductType);
}

// Purely structural/functional presets — no brand copy (site name, SEO,
// hero text, /about) is ever derived from this. Categories are additive
// only: switching type never renames or deletes an existing category.
export const SUGGESTED_CATEGORIES: Record<ProductType, string[]> = {
  sport: ["Vêtements", "Chaussures", "Accessoires"],
  cosmetique: ["Parfums", "Soins visage", "Maquillage", "Soins cheveux"],
};

// Reuses the color presets from lib/theme/presets.ts — just a sensible
// starting point, still changeable anytime via the theme picker.
export const THEME_BY_PRODUCT_TYPE: Record<ProductType, string> = {
  sport: "default",
  cosmetique: "rose",
};
