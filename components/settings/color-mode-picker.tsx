"use client";

import { useTransition } from "react";
import { Laptop, Moon, Sun } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast";
import { setColorMode } from "@/lib/actions/settings";
import { cn } from "@/lib/utils";

const MODES = [
  { id: "auto", icon: Laptop },
  { id: "light", icon: Sun },
  { id: "dark", icon: Moon },
] as const;

// "auto" leaves the existing sun/moon switcher in the storefront header —
// visitors pick light/dark themselves. "light"/"dark" locks the storefront
// to that mode and hides the switcher, for boutiques whose photos/branding
// only work in one of the two.
export function ColorModePicker({ currentMode }: { currentMode: string }) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const [pending, startTransition] = useTransition();

  function handleSelect(mode: string) {
    if (mode === currentMode || pending) return;
    startTransition(async () => {
      const result = await setColorMode(mode);
      if (result.error) {
        toast.error(tCommon("error"));
        return;
      }
      window.location.reload();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{t("colorModeSection")}</span>
      <p className="text-sm text-muted-foreground">{t("colorModeSectionHint")}</p>
      <div className="flex gap-2">
        {MODES.map(({ id, icon: Icon }) => {
          const selected = id === currentMode;
          return (
            <button
              key={id}
              type="button"
              disabled={pending}
              onClick={() => handleSelect(id)}
              aria-pressed={selected}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                selected
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {t(`colorModeOptions.${id}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
