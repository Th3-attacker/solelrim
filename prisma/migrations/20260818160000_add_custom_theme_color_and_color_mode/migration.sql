-- Custom accent color (hex) as an alternative to the fixed THEME_PRESETS
-- list, and a lock on which color mode (light/dark) visitors can use —
-- both additive, defaulting to the current behavior (no custom color set,
-- "auto" mode still lets visitors toggle light/dark themselves).
ALTER TABLE "StoreType" ADD COLUMN "customThemeColor" TEXT;
ALTER TABLE "StoreType" ADD COLUMN "colorMode" TEXT NOT NULL DEFAULT 'auto';
