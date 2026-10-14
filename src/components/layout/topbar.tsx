import { useMatches } from "@tanstack/react-router";
import { useTranslations } from "use-intl";
import { Icon } from "~/components/ui/icon";
import { LanguageSwitcher } from "./language-switcher";
import { Logo } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    // Message keys of the page's place in the admin, for the header's trail:
    // its section ("admin.nav.salesGroup") and its own name ("nav.orders").
    section?: string;
    title?: string;
  }
}

// The bar above every page: menu button, where you are, language, theme.
export function Topbar({
  columnOpen,
  onMenu,
}: {
  // On a large screen the button shows or hides the menu column; below,
  // it opens the menu as a drawer.
  columnOpen: boolean;
  onMenu: () => void;
}) {
  const t = useTranslations();
  const page = useMatches({
    select: (matches) => matches.findLast((match) => match.staticData.title)?.staticData,
  });

  return (
    <header className="sticky top-0 z-30 flex h-[60px] items-center gap-1 border-b border-line bg-surface px-2 md:h-16 md:gap-3 md:px-8 print:hidden">
      <button
        type="button"
        onClick={onMenu}
        className="inline-flex size-11 flex-none items-center justify-center rounded-xl text-ink hover:bg-tile md:size-10"
      >
        <Icon name="menu" className="size-5 md:size-[18px]" />
        <span className="sr-only lg:hidden">{t("admin.shell.openMenu")}</span>
        <span className="sr-only max-lg:hidden">
          {t(columnOpen ? "admin.shell.hideSidebar" : "admin.shell.showSidebar")}
        </span>
      </button>

      <Logo className="block h-6 flex-1 md:hidden" />

      {page?.title && (
        <nav
          aria-label={t("admin.shell.breadcrumbLabel")}
          className="hidden flex-1 text-[13px] text-muted md:block"
        >
          <ol className="flex items-center gap-1.5">
            {page.section && (
              <li className="flex items-center gap-1.5">
                {t(page.section)}
                <span aria-hidden="true">/</span>
              </li>
            )}
            <li aria-current="page" className="font-semibold text-ink">
              {t(page.title)}
            </li>
          </ol>
        </nav>
      )}

      <div className="flex flex-none items-center gap-2">
        <span className="hidden md:inline-flex">
          <LanguageSwitcher />
        </span>
        <ThemeToggle className="max-md:size-11 max-md:border-0" />
      </div>
    </header>
  );
}
