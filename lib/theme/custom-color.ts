import type { ThemePreset } from "@/lib/theme/presets";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function isValidHexColor(value: string): boolean {
  return HEX_RE.test(value);
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("")}`;
}

// Cheap perceptual-brightness approximation (no sRGB gamma correction) —
// good enough to pick a readable black/white foreground, not a real WCAG
// contrast audit.
function relativeLuminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function readableForeground(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  return relativeLuminance(r, g, b) > 0.6 ? "#111111" : "#ffffff";
}

// Blends the color toward white when it's too dark to read as a button
// background on a dark page — same reasoning as THEME_PRESETS, where the
// dark variant is always the lighter member of the light/dark pair.
function lightenForDarkMode(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  if (relativeLuminance(r, g, b) >= 0.45) return hex;
  const mix = 0.55;
  return rgbToHex(r + (255 - r) * mix, g + (255 - g) * mix, b + (255 - b) * mix);
}

// Derives a full light/dark ThemePreset from a single admin-picked hex
// color, so the storefront still has a legible accent in both color modes
// without asking the admin to pick two colors themselves.
export function buildCustomThemePreset(hex: string): ThemePreset {
  const light = { primary: hex, primaryForeground: readableForeground(hex), ring: hex };
  const darkPrimary = lightenForDarkMode(hex);
  const dark = {
    primary: darkPrimary,
    primaryForeground: readableForeground(darkPrimary),
    ring: darkPrimary,
  };
  return { id: "custom", light, dark };
}
