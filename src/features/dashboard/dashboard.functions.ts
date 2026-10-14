import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  getBestSellers,
  getLowStockVariants,
  getRevenueByDay,
  getSummaryStats,
} from "@/lib/queries/dashboard";
import { adminMiddleware } from "~/server/admin-middleware";
import { REVENUE_PERIODS, bucketRevenue, periodStart } from "./revenue";

// The dashboard's figures for the boutique being managed, in one round trip.
// Amounts leave as numbers (MRU, no subunit in use).
export const getDashboard = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async ({ context: { productType } }) => {
    const [
      summary,
      bestSellers,
      lowStock,
      pendingOrders,
      oldestPending,
      pendingRefunds,
      latestRefund,
      latestOrders,
    ] = await Promise.all([
      getSummaryStats(productType),
      getBestSellers(productType),
      getLowStockVariants(productType),
      prisma.order.count({ where: { productType, status: "PENDING" } }),
      prisma.order.findFirst({
        where: { productType, status: "PENDING" },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
      prisma.refundRequest.count({ where: { productType, status: "PENDING" } }),
      prisma.refundRequest.findFirst({
        where: { productType, status: "PENDING" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.order.findMany({
        where: { productType },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          reference: true,
          customerName: true,
          total: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      // The moment the figures were read: dates are told relative to it, the
      // same on the server and in the browser.
      now: new Date(),
      summary,
      bestSellers,
      lowStock,
      pending: { count: pendingOrders, oldestAt: oldestPending?.createdAt ?? null },
      refunds: { count: pendingRefunds, latestAt: latestRefund?.createdAt ?? null },
      latestOrders: latestOrders.map((order) => ({ ...order, total: order.total.toNumber() })),
    };
  });

// The chart alone, so switching its period reads nothing else again.
export const getRevenue = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .validator(z.object({ period: z.enum(REVENUE_PERIODS) }))
  .handler(async ({ context: { productType }, data: { period } }) => {
    const days = await getRevenueByDay(productType);
    const today = new Date().toISOString().slice(0, 10);
    const from = periodStart(period, today, days[0]?.day);
    const { unit, buckets } = bucketRevenue(days, from, today);
    const best = buckets.reduce<(typeof buckets)[number] | null>(
      (top, bucket) => (bucket.total > 0 && bucket.total > (top?.total ?? 0) ? bucket : top),
      null,
    );
    return { unit, buckets, best };
  });
