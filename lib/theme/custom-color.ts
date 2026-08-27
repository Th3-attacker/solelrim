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

// WCAG's own relative-luminance formula (sRGB gamma-corrected, not the cheap
// broadcast-luma approximation this used to use) — needed so contrastRatio
// below actually matches the ratio a real WCAG audit would report.
function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// WCAG contrast ratio between two colors: (L1 + 0.05) / (L2 + 0.05) with L1
// the lighter of the two. Ranges from 1 (identical) to 21 (black on white).
export function contrastRatio(hexA: string, hexB: string): number {
  const la = relativeLuminance(...hexToRgb(hexA));
  const lb = relativeLuminance(...hexToRgb(hexB));
  const [lighter, darker] = la > lb ? [la, lb] : [lb, la];
  return (lighter + 0.05) / (darker + 0.05);
}

const FOREGROUND_DARK = "#111111";
const FOREGROUND_LIGHT = "#ffffff";

// WCAG AA for normal-size text. The button text this picks a color for is
// never "large text" (which would allow the looser 3:1 threshold), so this
// is the right bar for every caller.
const MIN_TEXT_CONTRAST = 4.5;

function readableForeground(hex: string): string {
  // Picks whichever of black/white actually contrasts more against this
  // background, rather than guessing from a brightness threshold — a
  // brightness cutoff can land on the wrong side for the same reason it's
  // an approximation in the first place (equal luma, different contrast
  // against a fixed white/black pair).
  return contrastRatio(hex, FOREGROUND_DARK) >= contrastRatio(hex, FOREGROUND_LIGHT)
    ? FOREGROUND_DARK
    : FOREGROUND_LIGHT;
}

// True if this color can carry readable text at all — i.e. the better of
// the two readableForeground candidates still clears WCAG AA against it.
// Catches the "murky middle" hues (mid-tone, moderately saturated) where
// neither black nor white text ever reaches 4.5:1, which a pure
// black/white picker like readableForeground can't fix by itself since one
// of the two is always going to be *chosen* regardless of how bad it is.
export function meetsMinimumContrast(hex: string): boolean {
  return (
    Math.max(contrastRatio(hex, FOREGROUND_DARK), contrastRatio(hex, FOREGROUND_LIGHT)) >=
    MIN_TEXT_CONTRAST
  );
}

// Cheap perceptual-brightness approximation (no sRGB gamma correction) —
// only ever used below to decide "is this dark enough to lighten for dark
// mode", a color-harmony choice, not a contrast guarantee. Contrast math
// above always goes through the real WCAG relativeLuminance instead.
function perceivedBrightness(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// Blends the color toward white when it's too dark to read as a button
// background on a dark page — same reasoning as THEME_PRESETS, where the
// dark variant is always the lighter member of the light/dark pair.
function lightenForDarkMode(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  if (perceivedBrightness(r, g, b) >= 0.45) return hex;
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
