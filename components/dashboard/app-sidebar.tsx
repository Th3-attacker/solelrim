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
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { StoreScopeSwitcher } from "@/components/dashboard/store-scope-switcher";
import { NavUser } from "@/components/dashboard/nav-user";
import { Link, usePathname } from "@/i18n/navigation";
import { getDirection } from "@/i18n/routing";
import {
  ClipboardList,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  Tag,
  Ticket,
  Users,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

type StoreTypeOption = { key: string; label: string };
type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };

export function AppSidebar({
  storeTypes,
  currentScope,
  role,
  email,
}: {
  storeTypes: StoreTypeOption[];
  currentScope: string;
  role: "SUPERADMIN" | "BOUTIQUE_ADMIN";
  email: string;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const locale = useLocale();
  const side = getDirection(locale) === "rtl" ? "right" : "left";
  const { setOpenMobile } = useSidebar();

  const sections: { label?: string; items: NavItem[] }[] = [
    { items: [{ href: "/admin", label: t("dashboard"), icon: LayoutDashboard }] },
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
        { href: "/admin/orders", label: t("orders"), icon: ClipboardList },
        { href: "/admin/clients", label: t("clients"), icon: Users },
        { href: "/admin/promo-codes", label: t("promoCodes"), icon: Ticket },
      ],
    },
    {
      label: t("adminSection"),
      items: [{ href: "/admin/settings", label: t("settings"), icon: Settings }],
    },
  ];

  return (
    <Sidebar side={side} collapsible="icon">
      <SidebarHeader>
        <div className="px-2 py-1.5 text-sm font-semibold group-data-[collapsible=icon]:hidden">
          <Link href="/">Solelrim</Link>
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
