import { useId } from "react";
import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "use-intl";
import { CountBadge } from "~/components/ui/status";
import { Icon } from "~/components/ui/icon";
import { shellQuery } from "~/features/shell/shell.queries";
import type { Locale } from "~/i18n/config";
import { Account } from "./account";
import { BoutiqueSwitcher } from "./boutique-switcher";
import { navFor, type NavGroup } from "./nav";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={className}>
      <img src="/brand/solal-logo-marine.svg" alt="SOLAL" className="h-full w-auto dark:hidden" />
      <img
        src="/brand/solal-logo-light.svg"
        alt="SOLAL"
        className="hidden h-full w-auto dark:block"
      />
    </span>
  );
}

// The menu's content, the same in the desktop column and the phone's
// drawer: boutique, sections, the way to the shop, the account.
export function SidebarContent({
  locale,
  onNavigate,
  footer,
}: {
  locale: Locale;
  // Closes the drawer once a page is picked.
  onNavigate?: () => void;
  // Extra settings shown in the drawer (language, dark mode).
  footer?: React.ReactNode;
}) {
  const t = useTranslations();
  const { data } = useSuspenseQuery(shellQuery);
  const groups = navFor(data.admin.role);
  const shopUrl = data.boutique.domain
    ? `https://${data.boutique.domain}`
    : `${data.siteUrl}/${locale}/${data.boutique.key}`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <Logo className="block h-[30px]" />
        <span className="rounded-md bg-tint px-[7px] py-[3px] text-[10px] font-bold tracking-[1.2px] text-brand">
          {t("admin.shell.adminBadge")}
        </span>
      </div>
      <div className="px-3 pb-3">
        <BoutiqueSwitcher />
      </div>

      <nav
        aria-label={t("admin.shell.adminNavigationLabel")}
        className="min-h-0 flex-1 overflow-y-auto px-3 pb-3"
      >
        {groups.map((group) => (
          <NavSection
            key={group.label}
            group={group}
            locale={locale}
            counts={data.counts}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="flex flex-col gap-2 border-t border-line p-3">
        {footer}
        <a
          href={shopUrl}
          target="_blank"
          rel="noopener"
          className="flex h-9 items-center gap-2.5 rounded-control px-2.5 text-[13px] font-semibold no-underline"
        >
          <Icon name="external" className="size-4" />
          {t("admin.shell.viewStorefront")}
        </a>
        <Account locale={locale} />
      </div>
    </div>
  );
}

function NavSection({
  group,
  locale,
  counts,
  onNavigate,
}: {
  group: NavGroup;
  locale: Locale;
  counts: { pendingOrders: number; pendingRefunds: number };
  onNavigate?: () => void;
}) {
  const t = useTranslations();
  const labelId = useId();

  return (
    <section aria-labelledby={labelId}>
      <h2
        id={labelId}
        className="flex justify-between px-2.5 pt-3.5 pb-1.5 text-label text-muted uppercase"
      >
        {t(group.label)}
        {group.superadminOnly && (
          <span className="rounded-[5px] bg-tint px-1.5 py-px text-[10px] font-bold tracking-normal text-brand normal-case">
            {t("admin.shell.superadminOnlyBadge")}
          </span>
        )}
      </h2>
      <ul className="flex flex-col gap-0.5">
        {group.items.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              params={{ locale }}
              activeOptions={{ exact: item.to === "/$locale/admin", includeSearch: false }}
              onClick={onNavigate}
              className="flex h-[38px] items-center gap-2.5 rounded-control px-2.5 text-[14px] font-medium text-ink-2 no-underline hover:bg-bg hover:text-ink aria-[current=page]:bg-tint aria-[current=page]:font-semibold aria-[current=page]:text-brand"
            >
              <Icon name={item.icon} />
              <span className="flex-1">{t(item.label)}</span>
              {item.badge && (
                <CountBadge
                  count={counts[item.badge]}
                  label={t(`admin.shell.${item.badge}Count`, { count: counts[item.badge] })}
                />
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
