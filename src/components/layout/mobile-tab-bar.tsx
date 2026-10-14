import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "use-intl";
import { Icon } from "~/components/ui/icon";
import { shellQuery } from "~/features/shell/shell.queries";
import type { Locale } from "~/i18n/config";
import { navFor } from "./nav";

const tab =
  "relative flex flex-1 flex-col items-center justify-center gap-[3px] text-[11px] font-semibold text-muted no-underline aria-[current=page]:text-brand";

// Under 768 px: the main pages at thumb's reach, and « Plus » for the rest.
export function MobileTabBar({ locale, onMore }: { locale: Locale; onMore: () => void }) {
  const t = useTranslations();
  const { data } = useSuspenseQuery(shellQuery);
  const tabs = navFor(data.admin.role)
    .flatMap((group) => group.items)
    .filter((item) => item.tabBar);

  return (
    <nav
      aria-label={t("admin.shell.mobileTabBarLabel")}
      className="fixed inset-x-0 bottom-0 z-30 flex h-[calc(72px+env(safe-area-inset-bottom))] border-t border-line bg-surface pb-[calc(8px+env(safe-area-inset-bottom))] md:hidden print:hidden"
    >
      {tabs.map((item) => {
        const count = item.badge ? data.counts[item.badge] : 0;
        return (
          <Link
            key={item.to}
            to={item.to}
            params={{ locale }}
            activeOptions={{ exact: item.to === "/$locale/admin" }}
            className={tab}
          >
            <Icon name={item.icon} className="size-5" />
            {t(item.label)}
            {count > 0 && (
              <span className="absolute top-1.5 start-[54%] rounded-full bg-pend-bg px-[5px] text-[10px] font-bold text-pend-ink">
                <span aria-hidden="true">{count}</span>
                <span className="sr-only">{t(`admin.shell.${item.badge}Count`, { count })}</span>
              </span>
            )}
          </Link>
        );
      })}
      <button type="button" onClick={onMore} className={tab}>
        <Icon name="more" className="size-5" />
        {t("admin.shell.moreTab")}
      </button>
    </nav>
  );
}
