import type { OrderStatus } from "@/lib/generated/prisma/enums";

// A PENDING order now holds real reserved stock (see submitOrder in
// lib/actions/orders.ts) — an abandoned checkout the admin never notices can
// lock a unit indefinitely. Past this threshold the admin orders list/detail
// page flags the order so a human can confirm or reject it instead of it
// aging silently. A boutique can also have them cancelled on their own
// (StoreType.pendingAutoCancelHours, lib/shop/pending-expiry.ts).
export const STALE_PENDING_HOURS = 24;

// Choices offered for StoreType.pendingAutoCancelHours in the superadmin
// settings; null (never) is the default.
export const PENDING_AUTO_CANCEL_CHOICES = [24, 48, 72, 168] as const;

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
