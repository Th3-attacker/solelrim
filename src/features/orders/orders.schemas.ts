import { z } from "zod";
import { REJECT_REASON_PRESETS } from "@/lib/shop/order-reasons";

// The order statuses as they read in the address (?status=pending).
export const ORDER_TABS = [
  "all",
  "pending",
  "confirmed",
  "shipping",
  "delivered",
  "rejected",
  "cancelled",
] as const;
export type OrderTab = (typeof ORDER_TABS)[number];

export const ORDER_TAB_STATUS = {
  pending: "PENDING",
  confirmed: "CONFIRMED",
  shipping: "SHIPPING",
  delivered: "DELIVERED",
  rejected: "REJECTED",
  cancelled: "CANCELLED",
} as const satisfies Record<Exclude<OrderTab, "all">, string>;

export const ORDERS_PAGE_SIZE = 20;
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// The list's filters, in the address: shareable, kept on reload and back.
// Anything malformed falls back to its default instead of failing the page.
export const orderListSearchSchema = z.object({
  // The work queue first: payments to check.
  status: z.enum(ORDER_TABS).catch("pending").default("pending"),
  q: z.string().trim().max(40).optional().catch(undefined),
  from: day.optional().catch(undefined),
  to: day.optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1).default(1),
});
export type OrderListSearch = z.infer<typeof orderListSearchSchema>;

export const orderIdSchema = z.object({ orderId: z.string().min(1).max(64) });

// The presets of the reject dialog, or the admin's own words ("other").
export const rejectOrderSchema = orderIdSchema.extend({
  reason: z.string().trim().min(1).max(300),
});
export const cancelOrderSchema = rejectOrderSchema;

export { REJECT_REASON_PRESETS };
