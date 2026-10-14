import { Link } from "@tanstack/react-router";
import { useLocale, useTranslations } from "use-intl";
import { LOCALES, LOCALE_COOKIE, type Locale } from "~/i18n/config";
import { cn } from "~/lib/cn";

const SHORT: Record<Locale, string> = { fr: "FR", en: "EN", ar: "ع" };
const NATIVE: Record<Locale, string> = { fr: "Français", en: "English", ar: "العربية" };

// The same page in another language: links, so they open in a new tab too.
// The choice is remembered for the next visit to "/".
export function LanguageSwitcher({ wide = false }: { wide?: boolean }) {
  const t = useTranslations("admin.shell");
  const current = useLocale();

  return (
    <div
      role="group"
      aria-label={t("languageSwitcherLabel")}
      className={cn("inline-flex gap-0.5 rounded-control bg-tile p-[3px]", wide && "flex w-full")}
    >
      {LOCALES.map((locale) => (
        <Link
          key={locale}
          to="."
          params={(prev) => ({ ...prev, locale })}
          search={(prev) => prev}
          hrefLang={locale}
          lang={locale}
          aria-label={NATIVE[locale]}
          aria-current={locale === current ? "true" : undefined}
          onClick={() => {
            document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
          }}
          className={cn(
            "inline-flex h-8 min-w-9 items-center justify-center rounded-lg px-2 text-[12px] font-bold text-muted no-underline hover:text-ink",
            wide && "h-[34px] flex-1 text-[13px]",
            locale === current &&
              "bg-surface text-brand shadow-[0_1px_3px_rgb(15_23_42/0.12)] hover:text-brand",
          )}
        >
          {wide ? NATIVE[locale] : SHORT[locale]}
        </Link>
      ))}
    </div>
  );
}
