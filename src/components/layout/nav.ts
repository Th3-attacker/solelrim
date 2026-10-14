import type { IconName } from "~/components/ui/icon";
import type { AdminRole } from "~/server/admin-access";

// Admin pages under /$locale. An entry joins the menu with its page: each
// migration step adds its own (order of the design: Pilotage, Ventes,
// Catalogue, Clients, Boutique, Plateforme).
export type AdminPath = "/$locale/admin" | "/$locale/admin/orders";

export type NavItem = {
  to: AdminPath;
  // Message key of its label.
  label: string;
  icon: IconName;
  // Counted on the menu (shell.functions.ts).
  badge?: "pendingOrders" | "pendingRefunds";
  // Who sees it; everyone but sellers when absent.
  roles?: readonly AdminRole[];
  // Also on the phone's bottom bar (five places at most, "Plus" included).
  tabBar?: boolean;
};

export type NavGroup = { label: string; superadminOnly?: boolean; items: readonly NavItem[] };

export const NAV: readonly NavGroup[] = [
  {
    label: "admin.nav.overviewGroup",
    items: [{ to: "/$locale/admin", label: "nav.dashboard", icon: "dashboard", tabBar: true }],
  },
  {
    label: "admin.nav.salesGroup",
    items: [
      {
        to: "/$locale/admin/orders",
        label: "nav.orders",
        icon: "orders",
        badge: "pendingOrders",
        tabBar: true,
      },
    ],
  },
];

const ADMINS: readonly AdminRole[] = ["SUPERADMIN", "BOUTIQUE_ADMIN"];

// The menu as this role sees it: groups left empty are dropped.
export function navFor(role: AdminRole): NavGroup[] {
  return NAV.filter((group) => !group.superadminOnly || role === "SUPERADMIN")
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => (item.roles ?? ADMINS).includes(role)),
    }))
    .filter((group) => group.items.length > 0);
}
