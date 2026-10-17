import type { IconName } from "~/components/ui/icon";
import type { AdminRole } from "~/server/admin-access";

// Admin pages under /$locale. An entry joins the menu with its page: each
// migration step adds its own (order of the design: Pilotage, Ventes,
// Catalogue, Clients, Boutique, Plateforme).
export type AdminPath =
  | "/$locale/admin"
  | "/$locale/admin/orders"
  | "/$locale/admin/sales"
  | "/$locale/admin/pos"
  | "/$locale/admin/pos/my-sales"
  | "/$locale/admin/pos/refunds"
  | "/$locale/admin/pos/sessions"
  | "/$locale/admin/cash-closures";

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
  // Active only on its own page, not on the pages under it (the checkout,
  // not its sessions).
  exact?: boolean;
};

export type NavGroup = { label: string; superadminOnly?: boolean; items: readonly NavItem[] };

const STAFF: readonly AdminRole[] = ["SUPERADMIN", "BOUTIQUE_ADMIN", "SELLER"];

// Ses propres ventes et remboursements : les pages de la caisse, que voit
// seul le vendeur — un admin les suit depuis l'entrée Ventes.
const SELLERS: readonly AdminRole[] = ["SELLER"];

export const NAV: readonly NavGroup[] = [
  {
    label: "admin.nav.overviewGroup",
    items: [
      {
        to: "/$locale/admin",
        label: "nav.dashboard",
        icon: "dashboard",
        tabBar: true,
        exact: true,
      },
    ],
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
      { to: "/$locale/admin/sales", label: "nav.sales", icon: "sales", badge: "pendingRefunds" },
      {
        to: "/$locale/admin/pos",
        label: "nav.pos",
        icon: "pos",
        roles: STAFF,
        tabBar: true,
        exact: true,
      },
      {
        to: "/$locale/admin/pos/my-sales",
        label: "nav.mySales",
        icon: "sales",
        roles: SELLERS,
      },
      { to: "/$locale/admin/pos/refunds", label: "nav.refunds", icon: "refund", roles: SELLERS },
      { to: "/$locale/admin/pos/sessions", label: "nav.cashSessions", icon: "clock", roles: STAFF },
      { to: "/$locale/admin/cash-closures", label: "nav.cashClosures", icon: "lock" },
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
