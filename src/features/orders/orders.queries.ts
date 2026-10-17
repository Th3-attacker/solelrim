import { queryOptions } from "@tanstack/react-query";
import { getOrder, getOrderLabels, listOrders } from "./orders.functions";
import type { OrderListSearch } from "./orders.schemas";

// Every key starts with "orders": the live channel (live-orders.tsx) and
// each change of an order mark them all stale at once.
export const orderListQuery = (filters: OrderListSearch) =>
  queryOptions({
    queryKey: ["orders", "list", filters],
    queryFn: () => listOrders({ data: filters }),
  });

export const orderQuery = (orderId: string) =>
  queryOptions({
    queryKey: ["orders", "detail", orderId],
    queryFn: () => getOrder({ data: { orderId } }),
  });

export const orderLabelsQuery = (ids: string[]) =>
  queryOptions({
    queryKey: ["orders", "labels", ids],
    queryFn: () => getOrderLabels({ data: { ids } }),
  });
