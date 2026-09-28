import type { CSSProperties } from "react";

// Variant colors are free-text (e.g. "Noir", "Gris") rather than hex codes,
// so swatches are a best-effort lookup — unmapped names fall back to a
// neutral dot rather than guessing wrong. Compound names ("Black-White",
// "Red-Black-White") are hyphen-separated and rendered as a multi-section
// swatch, one segment per resolved part.
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
  olive: "#6b7a3a",
  kaki: "#7d7a54",
  khaki: "#7d7a54",
  bordeaux: "#7f1734",
  burgundy: "#7f1734",
  maroon: "#7f1734",
  marine: "#1e3a5f",
  navy: "#1e3a5f",
  corail: "#ff7f6b",
  coral: "#ff7f6b",
  moutarde: "#c9a227",
  mustard: "#c9a227",
  ivoire: "#f3ecdd",
  ivory: "#f3ecdd",
  chocolat: "#4a2c1a",
  chocolate: "#4a2c1a",
  taupe: "#8b7d6b",
  lavande: "#b57edc",
  lavender: "#b57edc",
  saumon: "#fa8072",
  salmon: "#fa8072",
  fuchsia: "#e0218a",
  // Broader fashion/retail palette — same "best-effort, fall back to
  // neutral" contract as above, just more names covered.
  menthe: "#5eead4",
  mint: "#5eead4",
  charbon: "#374151",
  anthracite: "#374151",
  charcoal: "#374151",
  indigo: "#6366f1",
  cyan: "#06b6d4",
  magenta: "#d946ef",
  mauve: "#b784a7",
  prune: "#6b2d5c",
  plum: "#6b2d5c",
  aubergine: "#3b0a45",
  cerise: "#e11d48",
  cherry: "#e11d48",
  grenat: "#7f1d1d",
  garnet: "#7f1d1d",
  terracotta: "#c2410c",
  abricot: "#fdba74",
  apricot: "#fdba74",
  camel: "#c19a6b",
  cognac: "#7c4a1e",
  cafe: "#4b3621",
  coffee: "#4b3621",
  creme: "#fefce8",
  cream: "#fefce8",
  emeraude: "#10b981",
  emerald: "#10b981",
  ciel: "#38bdf8",
  sky: "#38bdf8",
  royal: "#1d4ed8",
  roi: "#1d4ed8",
  petrole: "#0e7490",
  framboise: "#be185d",
  raspberry: "#be185d",
  lilas: "#c4b5fd",
  lilac: "#c4b5fd",
  perle: "#f5f3ef",
  pearl: "#f5f3ef",
  nude: "#e8c4a0",
  citron: "#facc15",
  lemon: "#facc15",
  lime: "#84cc16",
  anis: "#a3b12f",
  bronze: "#8c6b3f",
  cuivre: "#b45309",
  copper: "#b45309",
};

const FALLBACK_COLOR = "#a1a1aa";

function normalize(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function resolveOne(part: string): string {
  return COLOR_MAP[normalize(part)] ?? FALLBACK_COLOR;
}

/** Resolves a possibly hyphen-compound color name into one hex per segment. */
export function getSwatchColors(colorName: string): string[] {
  const parts = colorName
    .split("-")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.map(resolveOne) : [FALLBACK_COLOR];
}

export function getSwatchColor(colorName: string): string {
  return getSwatchColors(colorName)[0];
}

/** Inline style for a swatch dot: solid fill for one color, an even
 * conic-gradient split for compound names like "Black-White". */
export function getSwatchStyle(colorName: string): CSSProperties {
  const colors = getSwatchColors(colorName);
  if (colors.length <= 1) {
    return { backgroundColor: colors[0] };
  }
  const step = 100 / colors.length;
  const stops = colors
    .map((color, i) => `${color} ${i * step}% ${(i + 1) * step}%`)
    .join(", ");
  return { background: `conic-gradient(${stops})` };
}
