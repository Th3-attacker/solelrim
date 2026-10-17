import type { StatusTone } from "~/components/ui/status";

export type OrderStatus =
  "PENDING" | "CONFIRMED" | "SHIPPING" | "DELIVERED" | "REJECTED" | "CANCELLED";

// How each order status is shown: its tone, and its word (orders.<key>).
export const ORDER_STATUS: Record<
  OrderStatus,
  {
    tone: StatusTone;
    label: "pending" | "confirmed" | "shipping" | "delivered" | "rejected" | "cancelled";
  }
> = {
  PENDING: { tone: "pend", label: "pending" },
  CONFIRMED: { tone: "conf", label: "confirmed" },
  SHIPPING: { tone: "ship", label: "shipping" },
  DELIVERED: { tone: "ok", label: "delivered" },
  REJECTED: { tone: "bad", label: "rejected" },
  CANCELLED: { tone: "mute", label: "cancelled" },
};
