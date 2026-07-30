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

export function getThemePreset(id: string | null | undefined): ThemePreset {
  return THEME_PRESETS.find((preset) => preset.id === id) ?? THEME_PRESETS[0];
}
