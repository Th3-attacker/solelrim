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
  useSidebar,
} from "@/components/ui/sidebar";
import { StoreScopeSwitcher } from "@/components/dashboard/store-scope-switcher";
import { NavUser } from "@/components/dashboard/nav-user";
import { Link, usePathname } from "@/i18n/navigation";
import { getDirection } from "@/i18n/routing";
import {
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

type StoreTypeOption = { key: string; label: string };
type NavItem = { href: string; label: string; icon: typeof SquaresFour; badge?: number };

export function AppSidebar({
  storeTypes,
  currentScope,
  role,
  email,
  pendingOrderCount,
}: {
  storeTypes: StoreTypeOption[];
  currentScope: string;
  role: "SUPERADMIN" | "BOUTIQUE_ADMIN";
  email: string;
  pendingOrderCount: number;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const locale = useLocale();
  const side = getDirection(locale) === "rtl" ? "right" : "left";
  const { setOpenMobile } = useSidebar();

  const sections: { label?: string; items: NavItem[] }[] = [
    { items: [{ href: "/admin", label: t("dashboard"), icon: SquaresFour }] },
    {
      label: t("catalogSection"),
      items: [
        { href: "/admin/products", label: t("products"), icon: Package },
        { href: "/admin/categories", label: t("categories"), icon: Tag },
      ],
    },
    {
      label: t("activitySection"),
      items: [
        { href: "/admin/sales", label: t("sales"), icon: ShoppingCart },
        {
          href: "/admin/orders",
          label: t("orders"),
          icon: ClipboardText,
          badge: pendingOrderCount > 0 ? pendingOrderCount : undefined,
        },
        { href: "/admin/clients", label: t("clients"), icon: Users },
        { href: "/admin/promo-codes", label: t("promoCodes"), icon: Ticket },
      ],
    },
    {
      label: t("adminSection"),
      items: [
        { href: "/admin/settings", label: t("settings"), icon: Gear },
        // Superadmin-only (app/[locale]/admin/(dashboard)/audit-log/page.tsx
        // enforces this server-side too — hidden here just to not show a
        // link a boutique admin would hit a 404 on).
        ...(role === "SUPERADMIN"
          ? [{ href: "/admin/audit-log", label: t("auditLog"), icon: ClockCounterClockwise }]
          : []),
      ],
    },
  ];

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
          <SidebarGroup key={section.label ?? `section-${index}`}>
            {section.label && (
              <SidebarGroupLabel className="text-sm font-semibold">
                {section.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const isActive =
                    item.href === "/admin"
                      ? pathname === "/admin"
                      : pathname.startsWith(item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        size="lg"
                        tooltip={item.label}
                        className="text-base [&_svg]:size-5"
                      >
                        <Link href={item.href} onClick={() => setOpenMobile(false)}>
                          <item.icon />
                          <span>{item.label}</span>
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
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          email={email}
          roleLabel={role === "SUPERADMIN" ? t("superadmin") : t("boutiqueAdmin")}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
