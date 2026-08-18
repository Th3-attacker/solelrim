import { buildCustomThemePreset } from "@/lib/theme/custom-color";

type ThemeColors = {
  primary: string;
  primaryForeground: string;
  ring: string;
};

export type ThemePreset = {
  id: string;
  light: ThemeColors;
  dark: ThemeColors;
};

// Storefront accent presets only — the admin dashboard stays neutral
// regardless of which one is picked (see .shop-theme in app/globals.css).
export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "default",
    light: { primary: "#252525", primaryForeground: "#ffffff", ring: "#252525" },
    dark: { primary: "#ffffff", primaryForeground: "#252525", ring: "#606060" },
  },
  {
    id: "amber",
    light: { primary: "#b45309", primaryForeground: "#ffffff", ring: "#b45309" },
    dark: { primary: "#fbbf24", primaryForeground: "#451a03", ring: "#fbbf24" },
  },
  {
    id: "rose",
    light: { primary: "#be185d", primaryForeground: "#ffffff", ring: "#be185d" },
    dark: { primary: "#f9a8d4", primaryForeground: "#500724", ring: "#f9a8d4" },
  },
  {
    id: "sage",
    light: { primary: "#4b6a52", primaryForeground: "#ffffff", ring: "#4b6a52" },
    dark: { primary: "#9caf88", primaryForeground: "#1f2a1a", ring: "#9caf88" },
  },
  {
    id: "navy",
    light: { primary: "#1e3a5f", primaryForeground: "#ffffff", ring: "#1e3a5f" },
    dark: { primary: "#7fb2e5", primaryForeground: "#0b1e33", ring: "#7fb2e5" },
  },
];

export const DEFAULT_THEME_ID = "default";

// Sentinel themeId meaning "use customThemeColor" instead of one of the
// fixed THEME_PRESETS entries above.
export const CUSTOM_THEME_ID = "custom";

export function getThemePreset(id: string | null | undefined): ThemePreset {
  return THEME_PRESETS.find((preset) => preset.id === id) ?? THEME_PRESETS[0];
}

// Resolves a boutique's actual accent theme — a fixed preset, or a
// generated one from its picked hex color when themeId is the "custom"
// sentinel (falls back to the default preset if the color is somehow
// missing, e.g. themeId was set to "custom" without a color yet).
export function resolveStoreTheme(store: {
  themeId: string | null;
  customThemeColor: string | null;
}): ThemePreset {
  if (store.themeId === CUSTOM_THEME_ID && store.customThemeColor) {
    return buildCustomThemePreset(store.customThemeColor);
  }
  return getThemePreset(store.themeId);
}
