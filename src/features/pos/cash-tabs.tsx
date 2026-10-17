import { Link } from "@tanstack/react-router";
import { useTranslations } from "use-intl";
import type { Locale } from "~/i18n/config";

const tab =
  "inline-flex h-11 items-center border-b-2 border-transparent px-0.5 text-[14px] font-semibold text-muted no-underline hover:text-ink aria-[current=page]:border-brand aria-[current=page]:text-brand";

// Tills and day closures: two views of the same money, side by side.
export function CashTabs({
  locale,
  current,
}: {
  locale: Locale;
  current: "sessions" | "closures";
}) {
  const t = useTranslations("cash");
  return (
    <nav aria-label={t("cashSections")} className="flex gap-6 border-b border-line-soft px-5">
      <Link
        to="/$locale/admin/pos/sessions"
        params={{ locale }}
        className={tab}
        aria-current={current === "sessions" ? "page" : undefined}
      >
        {t("sessionsTitle")}
      </Link>
      <Link
        to="/$locale/admin/cash-closures"
        params={{ locale }}
        className={tab}
        aria-current={current === "closures" ? "page" : undefined}
      >
        {t("closuresTab")}
      </Link>
    </nav>
  );
}
