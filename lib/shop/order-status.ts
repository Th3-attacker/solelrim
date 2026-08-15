import type { OrderStatus } from "@/lib/generated/prisma/enums";

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
