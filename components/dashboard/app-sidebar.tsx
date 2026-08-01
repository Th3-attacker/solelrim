"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { StoreScopeSwitcher } from "@/components/dashboard/store-scope-switcher";
import { Link, usePathname } from "@/i18n/navigation";
import { getDirection } from "@/i18n/routing";
import {
  ClipboardList,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  Tag,
  Users,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

type StoreTypeOption = { key: string; label: string };

export function AppSidebar({
  storeTypes,
  currentScope,
  role,
}: {
  storeTypes: StoreTypeOption[];
  currentScope: string;
  role: "SUPERADMIN" | "BOUTIQUE_ADMIN";
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const locale = useLocale();
  const side = getDirection(locale) === "rtl" ? "right" : "left";
  const { setOpenMobile } = useSidebar();

  const items = [
    { href: "/admin", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/admin/products", label: t("products"), icon: Package },
    { href: "/admin/categories", label: t("categories"), icon: Tag },
    { href: "/admin/sales", label: t("sales"), icon: ShoppingCart },
    { href: "/admin/orders", label: t("orders"), icon: ClipboardList },
    { href: "/admin/clients", label: t("clients"), icon: Users },
    { href: "/admin/settings", label: t("settings"), icon: Settings },
  ];

  return (
    <Sidebar side={side}>
      <SidebarHeader>
        <div className="px-2 py-1.5 text-sm font-semibold">
          <Link href="/">Solelrim</Link>
        </div>
        {/* A boutique admin is permanently locked to one boutique — there's
            nothing for them to switch between, so the switcher (and the
            free-choice cookie it drives) is superadmin-only. */}
        {role === "SUPERADMIN" && (
          <div className="px-2 pb-1">
            <StoreScopeSwitcher storeTypes={storeTypes} currentScope={currentScope} />
          </div>
        )}
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
      </SidebarContent>
    </Sidebar>
  );
}
