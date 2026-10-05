// The help page's table of contents. The texts live in messages/*.json under
// "help.topics.<id>" (title, when, steps, issues); this file only decides
// which topic goes in which group, who sees it and where it points.

export type HelpAudience = "seller" | "admin";
export type HelpGroup = "start" | "daily" | "endOfDay" | "special" | "support";

export type HelpTopic = {
  id: string;
  group: HelpGroup;
  audiences: readonly HelpAudience[];
  // The page where the task is done, when there is one.
  href?: string;
  // Only the support team can do it: the topic shows the contact buttons.
  support?: boolean;
};

const BOTH = ["seller", "admin"] as const;
const ADMIN = ["admin"] as const;

export const HELP_GROUPS: readonly HelpGroup[] = [
  "start",
  "daily",
  "endOfDay",
  "special",
  "support",
];

export const HELP_TOPICS: readonly HelpTopic[] = [
  { id: "addProduct", group: "start", audiences: ADMIN, href: "/admin/products" },
  { id: "manageCategories", group: "start", audiences: ADMIN, href: "/admin/categories" },
  { id: "configureBoutique", group: "start", audiences: ADMIN, href: "/admin/settings" },
  { id: "createSeller", group: "start", audiences: ADMIN, href: "/admin/settings" },
  { id: "twoFactor", group: "start", audiences: ADMIN, href: "/admin/settings" },

  { id: "openRegister", group: "daily", audiences: BOTH, href: "/admin/pos/register" },
  { id: "sellAtCheckout", group: "daily", audiences: BOTH, href: "/admin/pos" },
  { id: "cashMovement", group: "daily", audiences: BOTH, href: "/admin/pos/register" },
  { id: "loyaltyCard", group: "daily", audiences: BOTH, href: "/admin/pos" },
  { id: "processOrder", group: "daily", audiences: ADMIN, href: "/admin/orders" },
  { id: "promoCode", group: "daily", audiences: ADMIN, href: "/admin/promo-codes" },
  { id: "manageClients", group: "daily", audiences: ADMIN, href: "/admin/clients" },

  { id: "closeRegister", group: "endOfDay", audiences: BOTH, href: "/admin/pos/register" },
  { id: "closeDay", group: "endOfDay", audiences: ADMIN, href: "/admin/cash-closures" },

  { id: "requestRefund", group: "special", audiences: BOTH, href: "/admin/pos/refunds" },
  { id: "decideRefund", group: "special", audiences: ADMIN, href: "/admin/pos/refunds" },
  { id: "cancelSale", group: "special", audiences: ADMIN, href: "/admin/sales" },
  { id: "forgottenRegister", group: "special", audiences: BOTH, href: "/admin/pos/sessions" },

  { id: "license", group: "support", audiences: BOTH, support: true },
  { id: "newBoutique", group: "support", audiences: ADMIN, support: true },
  { id: "domain", group: "support", audiences: ADMIN, support: true },
  { id: "sellerQuota", group: "support", audiences: ADMIN, support: true },
  { id: "adminAccount", group: "support", audiences: ADMIN, support: true },
  { id: "lostTwoFactor", group: "support", audiences: ADMIN, support: true },
  { id: "appearance", group: "support", audiences: ADMIN, support: true },
];

export function topicsFor(audience: HelpAudience): HelpTopic[] {
  return HELP_TOPICS.filter((topic) => topic.audiences.includes(audience));
}
