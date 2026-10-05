"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { StoreScopeSwitcher } from "@/components/dashboard/store-scope-switcher";
import { NavUser } from "@/components/dashboard/nav-user";
import { Link, usePathname } from "@/i18n/navigation";
import { getDirection } from "@/i18n/routing";
import {
  ArrowCounterClockwise,
  CashRegister,
  ListChecks,
  Receipt,
  Money,
  Vault,
  ClipboardText,
  ClockCounterClockwise,
  SquaresFour,
  Package,
  Gear,
  ShoppingCart,
  Tag,
  Ticket,
  Users,
} from "@phosphor-icons/react/dist/ssr";
import { useLocale, useTranslations } from "next-intl";
import { Fragment } from "react";

type StoreTypeOption = { key: string; label: string };
type NavItem = {
  href: string;
  label: string;
  icon: typeof SquaresFour;
  badge?: number;
};

type Translate = ReturnType<typeof useTranslations<"nav">>;
type NavSection = { label?: string; items: NavItem[] };

// The checkout links both roles share, so a rename or a new route is made
// once.
const posLinks = (t: Translate) => ({
  pos: { href: "/admin/pos", label: t("pos"), icon: CashRegister },
  sessions: {
    href: "/admin/pos/sessions",
    label: t("cashSessions"),
    icon: ListChecks,
  },
  refunds: (badge?: number): NavItem => ({
    href: "/admin/pos/refunds",
    label: t("refunds"),
    icon: ArrowCounterClockwise,
    badge: badge && badge > 0 ? badge : undefined,
  }),
});

// A seller only ever reaches the checkout (proxy.ts redirects every
// other admin path) — no point listing links they'd bounce off.
function sellerSections(t: Translate): NavSection[] {
  const pos = posLinks(t);
  return [
    {
      items: [
        pos.pos,
        { href: "/admin/pos/register", label: t("register"), icon: Money },
        { href: "/admin/pos/my-sales", label: t("mySales"), icon: Receipt },
        pos.refunds(),
        pos.sessions,
      ],
    },
  ];
}

function adminSections(
  t: Translate,
  counts: { pendingOrderCount: number; pendingRefundCount: number },
): NavSection[] {
  const pos = posLinks(t);
  return [
    { items: [{ href: "/admin", label: t("dashboard"), icon: SquaresFour }] },
    {
      label: t("catalogSection"),
      items: [
        { href: "/admin/products", label: t("products"), icon: Package },
        { href: "/admin/categories", label: t("categories"), icon: Tag },
      ],
    },
    {
      label: t("salesSection"),
      items: [
        { href: "/admin/sales", label: t("sales"), icon: ShoppingCart },
        {
          href: "/admin/orders",
          label: t("orders"),
          icon: ClipboardText,
          badge: counts.pendingOrderCount > 0 ? counts.pendingOrderCount : undefined,
        },
        { href: "/admin/clients", label: t("clients"), icon: Users },
        { href: "/admin/promo-codes", label: t("promoCodes"), icon: Ticket },
      ],
    },
    {
      label: t("posSection"),
      items: [
        pos.pos,
        pos.sessions,
        { href: "/admin/cash-closures", label: t("cashClosures"), icon: Vault },
        pos.refunds(counts.pendingRefundCount),
      ],
    },
    {
      label: t("adminSection"),
      items: [
        { href: "/admin/settings", label: t("settings"), icon: Gear },
        // Sellers never get here (they have their own sections); the page
        // itself scopes a boutique admin to their own boutique.
        {
          href: "/admin/audit-log",
          label: t("auditLog"),
          icon: ClockCounterClockwise,
        },
      ],
    },
  ];
}

export function AppSidebar({
  storeTypes,
  currentScope,
  role,
  email,
  pendingOrderCount,
  pendingRefundCount,
}: {
  storeTypes: StoreTypeOption[];
  currentScope: string;
  role: "SUPERADMIN" | "BOUTIQUE_ADMIN" | "SELLER";
  email: string;
  pendingOrderCount: number;
  pendingRefundCount: number;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const locale = useLocale();
  const side = getDirection(locale) === "rtl" ? "right" : "left";
  const { setOpenMobile } = useSidebar();

  const sections =
    role === "SELLER"
      ? sellerSections(t)
      : adminSections(t, { pendingOrderCount, pendingRefundCount });
  // The most specific link wins: on /admin/pos/sessions, "Caisse"
  // (/admin/pos) must not light up too.
  const matches = (href: string) =>
    href === "/admin"
      ? pathname === "/admin"
      : pathname === href || pathname.startsWith(`${href}/`);
  const activeHref = sections
    .flatMap((section) => section.items)
    .map((item) => item.href)
    .reduce<string | undefined>(
      (best, href) => (matches(href) && (!best || href.length > best.length) ? href : best),
      undefined,
    );

  const roleLabel =
    role === "SUPERADMIN" ? t("superadmin") : role === "SELLER" ? t("seller") : t("boutiqueAdmin");

  return (
    <Sidebar side={side} collapsible="icon">
      <SidebarHeader>
        <div className="px-2 py-1.5 text-sm font-semibold group-data-[collapsible=icon]:hidden">
          <Link href="/">SOLAL</Link>
        </div>
        {/* A boutique admin is permanently locked to one boutique — there's
            nothing for them to switch between, so the switcher (and the
            free-choice cookie it drives) is superadmin-only. */}
        {role === "SUPERADMIN" && (
          <div className="px-2 pb-1 group-data-[collapsible=icon]:hidden">
            <StoreScopeSwitcher storeTypes={storeTypes} currentScope={currentScope} />
          </div>
        )}
      </SidebarHeader>
      <SidebarContent>
        {sections.map((section, index) => (
          <Fragment key={section.label ?? `section-${index}`}>
            {/* The group labels disappear when the sidebar is collapsed to
                icons: a rule between groups keeps the categories apart. */}
            {index > 0 && (
              <SidebarSeparator className="mx-2 hidden w-auto group-data-[collapsible=icon]:block" />
            )}
            <SidebarGroup>
              {section.label && (
                <SidebarGroupLabel className="text-sm font-semibold">
                  {section.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => {
                    const isActive = item.href === activeHref;
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          size="lg"
                          tooltip={item.label}
                          className="text-base group-data-[collapsible=icon]:justify-center [&_svg]:size-5"
                        >
                          <Link href={item.href} onClick={() => setOpenMobile(false)}>
                            <item.icon />
                            <span className="group-data-[collapsible=icon]:hidden">
                              {item.label}
                            </span>
                          </Link>
                        </SidebarMenuButton>
                        {item.badge !== undefined && (
                          <SidebarMenuBadge className="bg-warning/10 text-warning dark:bg-warning/20">
                            {item.badge}
                          </SidebarMenuBadge>
                        )}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </Fragment>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser email={email} roleLabel={roleLabel} />
      </SidebarFooter>
    </Sidebar>
  );
}
