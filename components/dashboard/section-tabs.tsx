import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

// The admin pages that share one sidebar entry (the sidebar lists only the
// first; see alsoActiveFor in app-sidebar.tsx): each shows this bar on top
// to reach its siblings.
const GROUPS = {
  catalog: [
    { href: "/admin/products", label: "products" },
    { href: "/admin/categories", label: "categories" },
  ],
  sales: [
    { href: "/admin/sales", label: "sales" },
    { href: "/admin/pos/refunds", label: "refunds" },
  ],
  clients: [
    { href: "/admin/clients", label: "clients" },
    { href: "/admin/promo-codes", label: "promoCodes" },
  ],
  cash: [
    { href: "/admin/pos/sessions", label: "cashSessions" },
    { href: "/admin/cash-closures", label: "cashClosures" },
  ],
} as const;

export type SectionTabsGroup = keyof typeof GROUPS;

export async function SectionTabs({
  group,
  current,
  pendingRefunds = 0,
}: {
  group: SectionTabsGroup;
  current: string;
  // Shown on the refunds tab so a waiting request isn't hidden behind it.
  pendingRefunds?: number;
}) {
  const t = await getTranslations("nav");

  return (
    <nav aria-label={t("sectionTabs")} className="flex gap-1 border-b">
      {GROUPS[group].map((tab) => {
        const active = tab.href === current;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t(tab.label)}
            {tab.href === "/admin/pos/refunds" && pendingRefunds > 0 && (
              <span className="rounded-full bg-warning/10 px-1.5 text-xs text-warning dark:bg-warning/20">
                {pendingRefunds}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
