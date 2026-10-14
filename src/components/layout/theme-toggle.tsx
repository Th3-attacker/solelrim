import { useTranslations } from "use-intl";
import { cn } from "~/lib/cn";
import { Icon } from "~/components/ui/icon";
import { Switch } from "~/components/ui/field";
import { useSyncExternalStore } from "react";

// The theme lives on <html class="dark"> (set before the first paint by the
// root's script) and in localStorage under "theme", like next-themes did.
function setDark(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  try {
    localStorage.setItem("theme", dark ? "dark" : "light");
  } catch {
    // Private mode: the choice lasts for this page only.
  }
  listeners.forEach((listener) => listener());
}

const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
const isDark = () => document.documentElement.classList.contains("dark");

function useDark() {
  // The server can't know: it renders light, the browser corrects at once.
  return useSyncExternalStore(subscribe, isDark, () => false);
}

// The header's moon/sun button. Its icon and label follow the class through
// CSS, so the first render is right whichever theme the page opened in.
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations("admin.shell");
  return (
    <button
      type="button"
      onClick={() => setDark(!isDark())}
      className={cn(
        "inline-flex size-10 flex-none items-center justify-center rounded-control border border-line-strong bg-surface text-ink hover:bg-surface-2",
        className,
      )}
    >
      <Icon name="moon" className="dark:hidden" />
      <Icon name="sun" className="hidden dark:block" />
      <span className="sr-only dark:hidden">{t("switchToDarkMode")}</span>
      <span className="sr-only hidden dark:inline">{t("switchToLightMode")}</span>
    </button>
  );
}

// The same choice as a switch, in the phone's menu.
export function DarkModeSwitch() {
  const t = useTranslations("admin.shell");
  const dark = useDark();
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13px] font-semibold">{t("darkModeSwitch")}</span>
      <Switch checked={dark} onCheckedChange={setDark} label={t("darkModeSwitch")} />
    </div>
  );
}
