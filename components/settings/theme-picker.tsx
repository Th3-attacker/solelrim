"use client";

import { useTransition } from "react";
import { Check, Pipette } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast";
import { setCustomThemeColor, setStoreTheme } from "@/lib/actions/settings";
import { CUSTOM_THEME_ID } from "@/lib/theme/presets";
import { cn } from "@/lib/utils";
import type { ThemePreset } from "@/lib/theme/presets";

export function ThemePicker({
  presets,
  currentThemeId,
  customColor,
}: {
  presets: ThemePreset[];
  currentThemeId: string;
  customColor: string | null;
}) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const [pending, startTransition] = useTransition();

  function handleSelect(id: string) {
    if (id === currentThemeId || pending) return;
    startTransition(async () => {
      const result = await setStoreTheme(id);
      if (result.error) {
        toast.error(tCommon("error"));
        return;
      }
      window.location.reload();
    });
  }

  function handleCustomColor(color: string) {
    startTransition(async () => {
      const result = await setCustomThemeColor(color);
      if (result.error) {
        toast.error(tCommon("error"));
        return;
      }
      window.location.reload();
    });
  }

  const customSelected = currentThemeId === CUSTOM_THEME_ID;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{t("themeSection")}</span>
      <div className="flex flex-wrap items-center gap-3">
        {presets.map((preset) => {
          const selected = preset.id === currentThemeId;
          const label = t(`themePresets.${preset.id}`);
          return (
            <button
              key={preset.id}
              type="button"
              disabled={pending}
              onClick={() => handleSelect(preset.id)}
              aria-label={label}
              aria-pressed={selected}
              title={label}
              className={cn(
                "flex size-10 items-center justify-center rounded-full border-2 transition-colors",
                selected ? "border-foreground" : "border-transparent",
              )}
            >
              <span
                className="flex size-8 items-center justify-center rounded-full border border-border/50"
                style={{ backgroundColor: preset.light.primary }}
              >
                {selected && (
                  <Check
                    className="size-4"
                    style={{ color: preset.light.primaryForeground }}
                  />
                )}
              </span>
            </button>
          );
        })}

        <label
          title={t("themeCustomColor")}
          className={cn(
            "relative flex size-10 cursor-pointer items-center justify-center rounded-full border-2 transition-colors",
            customSelected ? "border-foreground" : "border-transparent",
          )}
        >
          <span
            className="flex size-8 items-center justify-center rounded-full border border-border/50"
            style={{ backgroundColor: customColor ?? "var(--muted)" }}
          >
            {customSelected ? (
              <Check
                className="size-4"
                style={{ color: customColor ? undefined : "var(--muted-foreground)" }}
              />
            ) : (
              <Pipette className="size-4 text-muted-foreground" />
            )}
          </span>
          <input
            type="color"
            aria-label={t("themeCustomColor")}
            disabled={pending}
            value={customColor ?? "#252525"}
            onChange={(e) => handleCustomColor(e.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </label>
      </div>
    </div>
  );
}
