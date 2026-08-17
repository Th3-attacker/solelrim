import type { OrderStatus } from "@/lib/generated/prisma/enums";

// A PENDING order now holds real reserved stock (see submitOrder in
// lib/actions/orders.ts) — unlike before, an abandoned checkout the admin
// never notices can lock a unit indefinitely. No auto-expiry job exists
// (this app has zero API/cron routes today), so this is only a visual
// threshold: past it, the admin orders list/detail page flags the order so
// a human can confirm or reject it instead of it aging silently.
export const STALE_PENDING_HOURS = 24;

// Maps each status to its translation key under the "orders" namespace —
// shared between the filter dropdown (client) and the CSV export (server),
// so the label shown never drifts from the label filtered/exported by.
export const ORDER_STATUS_LABEL_KEY: Record<OrderStatus, string> = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  SHIPPING: "shipping",
  DELIVERED: "delivered",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
};
