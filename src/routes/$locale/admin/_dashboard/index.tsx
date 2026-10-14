import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, stripSearchParams, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { dashboardQuery, revenueQuery } from "~/features/dashboard/dashboard.queries";
import { REVENUE_PERIODS } from "~/features/dashboard/revenue";
import {
  BestSellers,
  KeyFigures,
  LatestOrders,
  LowStock,
  RevenueCard,
  ToHandle,
  Welcome,
} from "~/features/dashboard/dashboard-sections";

const searchSchema = z.object({
  // The chart's period lives in the address: shareable, kept on reload.
  period: z.enum(REVENUE_PERIODS).catch("all").default("all"),
});

export const Route = createFileRoute("/$locale/admin/_dashboard/")({
  validateSearch: searchSchema,
  // The default period stays out of the address.
  search: { middlewares: [stripSearchParams({ period: "all" })] },
  loaderDeps: ({ search }) => ({ period: search.period }),
  loader: ({ context: { queryClient }, deps }) =>
    Promise.all([
      queryClient.ensureQueryData(dashboardQuery),
      queryClient.ensureQueryData(revenueQuery(deps.period)),
    ]),
  staticData: { section: "admin.nav.overviewGroup", title: "nav.dashboard" },
  component: DashboardPage,
});

const page = "mx-auto flex max-w-[1180px] flex-col gap-5 px-4 pt-7 pb-14 md:px-8";

function DashboardPage() {
  const { data } = useSuspenseQuery(dashboardQuery);
  return (
    <div className={page}>
      <Welcome now={data.now} summary={data.summary} pendingCount={data.pending.count} />
      <ToHandle data={data} />
      <KeyFigures summary={data.summary} lowStockCount={data.lowStock.length} />
      <Revenue />
      <div className="grid gap-5 lg:grid-cols-2">
        <BestSellers items={data.bestSellers} />
        <LowStock items={data.lowStock} />
      </div>
      <LatestOrders orders={data.latestOrders} now={data.now} />
    </div>
  );
}

// The chart's period comes from the address and goes back to it.
function Revenue() {
  const { period } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data } = useSuspenseQuery(revenueQuery(period));
  return (
    <RevenueCard
      period={period}
      data={data}
      onPeriodChange={(next) =>
        void navigate({ search: { period: next }, replace: true, resetScroll: false })
      }
    />
  );
}
