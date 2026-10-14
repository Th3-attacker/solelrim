import { queryOptions } from "@tanstack/react-query";
import type { RevenuePeriod } from "./revenue";
import { getDashboard, getRevenue } from "./dashboard.functions";

// Kept fresh by the live channel too (orders change → ["orders"] goes stale,
// and the dashboard lists orders): see live-orders.tsx.
export const dashboardQuery = queryOptions({
  queryKey: ["orders", "dashboard"],
  queryFn: () => getDashboard(),
});

export const revenueQuery = (period: RevenuePeriod) =>
  queryOptions({
    queryKey: ["dashboard", "revenue", period],
    queryFn: () => getRevenue({ data: { period } }),
  });
