"use client";

import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  ClipboardList,
  Settings,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Link, usePathname } from "@/i18n/navigation";
import { getDirection } from "@/i18n/routing";

export function AppSidebar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const locale = useLocale();
  const side = getDirection(locale) === "rtl" ? "right" : "left";

  const items = [
    { href: "/admin", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/admin/products", label: t("products"), icon: Package },
    { href: "/admin/sales", label: t("sales"), icon: ShoppingCart },
    { href: "/admin/orders", label: t("orders"), icon: ClipboardList },
    { href: "/admin/clients", label: t("clients"), icon: Users },
    { href: "/admin/settings", label: t("settings"), icon: Settings },
  ];

  return (
    <Sidebar side={side}>
      <SidebarHeader>
        <div className="px-2 py-1.5 text-sm font-semibold">Solelrim</div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.href}>
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
      </SidebarContent>
    </Sidebar>
  );
}
