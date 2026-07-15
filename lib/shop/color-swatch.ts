// Variant colors are free-text (e.g. "Noir", "Gris") rather than hex codes,
// so swatches are a best-effort lookup — unmapped names fall back to a
// neutral dot rather than guessing wrong.
const COLOR_MAP: Record<string, string> = {
  noir: "#18181b",
  black: "#18181b",
  blanc: "#ffffff",
  white: "#ffffff",
  gris: "#9ca3af",
  grey: "#9ca3af",
  gray: "#9ca3af",
  rouge: "#ef4444",
  red: "#ef4444",
  bleu: "#3b82f6",
  blue: "#3b82f6",
  vert: "#22c55e",
  green: "#22c55e",
  jaune: "#eab308",
  yellow: "#eab308",
  orange: "#f97316",
  marron: "#92400e",
  brown: "#92400e",
  rose: "#ec4899",
  pink: "#ec4899",
  violet: "#8b5cf6",
  purple: "#8b5cf6",
  beige: "#d6c7ae",
  dore: "#ca8a04",
  gold: "#ca8a04",
  argente: "#c0c0c0",
  silver: "#c0c0c0",
  turquoise: "#14b8a6",
  teal: "#14b8a6",
};

const FALLBACK_COLOR = "#a1a1aa";

function normalize(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function getSwatchColor(colorName: string): string {
  return COLOR_MAP[normalize(colorName)] ?? FALLBACK_COLOR;
}
