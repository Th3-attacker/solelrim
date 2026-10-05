// Any non-empty string is a valid store type — "sport" and "cosmetique"
// are just the two built-in presets with translated copy, a suggested
// category set, and a default theme. A custom type (createProductType,
// lib/actions/settings.ts) is any other string: it displays as typed
// (no translation), keeps whatever theme is active, and only gets the
// categories the admin explicitly creates for it.
export type ProductType = string;

export const DEFAULT_PRODUCT_TYPE: ProductType = "sport";

// Purely structural/functional presets — no brand copy (site name, SEO,
// hero text, /about) is ever derived from this. Categories are additive
// only: switching type never renames or deletes an existing category.
export const SUGGESTED_CATEGORIES: Record<string, string[]> = {
  sport: ["Vêtements", "Chaussures", "Accessoires"],
  cosmetique: ["Parfums", "Soins visage", "Maquillage", "Soins cheveux"],
};

// A sentinel that must never resolve to a real boutique key (see
// RESERVED_STORE_TYPE_KEYS below).
const NOT_FOUND_STORE_TYPE_KEY = "__not-found__";

// Keys a boutique can never claim (createProductType, lib/actions/settings.ts):
// - "admin" would collide with the static app/[locale]/admin/ route — Next.js
//   always prefers a static folder over the [storeType] dynamic segment, so
//   a boutique keyed "admin" would silently never be reachable.
// - NOT_FOUND_STORE_TYPE_KEY, see above.
export const RESERVED_STORE_TYPE_KEYS = new Set([
  "admin",
  NOT_FOUND_STORE_TYPE_KEY,
]);
