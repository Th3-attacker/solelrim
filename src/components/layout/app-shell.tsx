import { useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "use-intl";
import { cn } from "~/lib/cn";
import { Sheet } from "~/components/ui/dialog";
import { shellQuery } from "~/features/shell/shell.queries";
import type { Locale } from "~/i18n/config";
import { LanguageSwitcher } from "./language-switcher";
import { LiveOrders } from "./live-orders";
import { MobileTabBar } from "./mobile-tab-bar";
import { SidebarContent } from "./sidebar";
import { DarkModeSwitch } from "./theme-toggle";
import { Topbar } from "./topbar";

// The frame of every admin page. From 1024 px the menu is a column the
// header button hides or shows; below, a drawer. Under 768 px the main
// pages also sit in a bar at the bottom.
export function AppShell({ locale, children }: { locale: Locale; children: ReactNode }) {
  const t = useTranslations("admin.shell");
  const { data } = useSuspenseQuery(shellQuery);
  const [columnOpen, setColumnOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // A navigation started: the bar shows it after a short while.
  const loading = useRouterState({ select: (state) => state.status === "pending" });

  const toggleMenu = () => {
    if (window.matchMedia("(min-width: 1024px)").matches) setColumnOpen((open) => !open);
    else setDrawerOpen(true);
  };

  return (
    <div
      className={cn(
        "min-h-dvh lg:grid",
        columnOpen ? "lg:grid-cols-[256px_minmax(0,1fr)]" : "lg:grid-cols-1",
      )}
    >
      <a
        href="#content"
        className="sr-only z-50 rounded-control bg-brand px-4 py-2 font-semibold text-on-brand focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      >
        {t("skipToContent")}
      </a>

      {columnOpen && (
        <aside className="sticky top-0 hidden h-dvh border-e border-line bg-surface lg:block print:hidden">
          <SidebarContent locale={locale} />
        </aside>
      )}

      <div className="flex min-w-0 flex-col">
        <Topbar columnOpen={columnOpen} onMenu={toggleMenu} />
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none fixed inset-x-0 top-0 z-40 h-0.5 origin-left bg-brand transition-[opacity,transform] duration-500 [transition-delay:150ms] rtl:origin-right",
            loading
              ? "scale-x-75 opacity-100"
              : "scale-x-0 opacity-0 duration-150 [transition-delay:0ms]",
          )}
        />
        <main id="content" tabIndex={-1} className="flex-1 pb-24 outline-none md:pb-0">
          {children}
        </main>
      </div>

      <MobileTabBar locale={locale} onMore={() => setDrawerOpen(true)} />

      <Sheet
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        side="start"
        title={t("menuDrawerTitle")}
        titleHidden
      >
        <SidebarContent
          locale={locale}
          onNavigate={() => setDrawerOpen(false)}
          footer={
            <div className="flex flex-col gap-3 pb-1">
              <LanguageSwitcher wide />
              <DarkModeSwitch />
            </div>
          }
        />
      </Sheet>

      <LiveOrders productType={data.boutique.key} />
    </div>
  );
}
