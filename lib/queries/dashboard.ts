import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";

// daysBack omitted (or undefined) fetches the entire sales history — the
// dashboard page always fetches unfiltered now so the chart's client-side
// range toggle (including "all time") never needs a second round trip.
// A sale's revenue is what was kept: its total minus any refunds. Cancelled
// sales never count; refunded ones count for what wasn't given back.
function netRevenue(sum: {
  total: { toNumber(): number } | null;
  refundedAmount: { toNumber(): number } | null;
}): number {
  return (sum.total?.toNumber() ?? 0) - (sum.refundedAmount?.toNumber() ?? 0);
}

export async function getRevenueByDay(productType: string, daysBack?: number) {
  const cutoff = daysBack !== undefined ? new Date() : null;
  if (cutoff) cutoff.setDate(cutoff.getDate() - daysBack!);

  const rows = await prisma.$queryRaw<{ day: Date; total: number }[]>`
    SELECT date_trunc('day', "createdAt") AS day, SUM("total" - "refundedAmount")::float AS total
    FROM "Sale"
    WHERE "status" <> 'CANCELLED'
      AND "productType" = ${productType}
      ${cutoff ? Prisma.sql`AND "createdAt" >= ${cutoff}` : Prisma.empty}
    GROUP BY day
    ORDER BY day ASC
  `;

  return rows.map((row) => ({
    day: row.day.toISOString().slice(0, 10),
    total: Number(row.total),
  }));
}

export async function getBestSellers(productType: string, limit = 5) {
  const grouped = await prisma.saleItem.groupBy({
    by: ["variantId"],
    where: { sale: { productType } },
    _sum: { quantity: true, lineTotal: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit,
  });

  const variants = await prisma.productVariant.findMany({
    where: { id: { in: grouped.map((g) => g.variantId) } },
    include: { product: true },
  });
  const variantById = new Map(variants.map((v) => [v.id, v]));

  return grouped
    .map((g) => {
      const variant = variantById.get(g.variantId);
      if (!variant) return null;
      return {
        variantId: g.variantId,
        productName: variant.product.name,
        size: variant.size,
        color: variant.color,
        quantity: g._sum.quantity ?? 0,
        revenue: g._sum.lineTotal?.toNumber() ?? 0,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

export async function getLowStockVariants(productType: string) {
  return prisma.$queryRaw<
    {
      id: string;
      size: string;
      color: string;
      stock: number;
      productName: string;
    }[]
  >`
    SELECT v.id, v.size, v.color, v.stock, p.name AS "productName"
    FROM "ProductVariant" v
    JOIN "Product" p ON p.id = v."productId"
    WHERE v.stock <= v."lowStockThreshold" AND p."productType" = ${productType}
    ORDER BY v.stock ASC
  `;
}

export async function getSummaryStats(productType: string) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const startOfLastMonth = new Date(startOfMonth);
  startOfLastMonth.setMonth(startOfLastMonth.getMonth() - 1);

  const [
    revenueAgg,
    salesCount,
    lastMonthRevenueAgg,
    lastMonthSalesCount,
    allTimeRevenueAgg,
    allTimeSalesCount,
    activeClients,
    newClientsThisMonth,
    stockAgg,
  ] = await Promise.all([
    prisma.sale.aggregate({
      where: { status: { not: "CANCELLED" }, createdAt: { gte: startOfMonth }, productType },
      _sum: { total: true, refundedAmount: true },
    }),
    prisma.sale.count({
      where: { status: { not: "CANCELLED" }, createdAt: { gte: startOfMonth }, productType },
    }),
    prisma.sale.aggregate({
      where: {
        status: { not: "CANCELLED" },
        createdAt: { gte: startOfLastMonth, lt: startOfMonth },
        productType,
      },
      _sum: { total: true, refundedAmount: true },
    }),
    prisma.sale.count({
      where: {
        status: { not: "CANCELLED" },
        createdAt: { gte: startOfLastMonth, lt: startOfMonth },
        productType,
      },
    }),
    prisma.sale.aggregate({
      where: { status: { not: "CANCELLED" }, productType },
      _sum: { total: true, refundedAmount: true },
    }),
    prisma.sale.count({
      where: { status: { not: "CANCELLED" }, productType },
    }),
    prisma.client.count({ where: { productType } }),
    prisma.client.count({
      where: { productType, createdAt: { gte: startOfMonth } },
    }),
    prisma.productVariant.aggregate({
      where: { product: { productType } },
      _sum: { stock: true },
    }),
  ]);

  return {
    revenueThisMonth: netRevenue(revenueAgg._sum),
    revenueLastMonth: netRevenue(lastMonthRevenueAgg._sum),
    salesThisMonth: salesCount,
    salesLastMonth: lastMonthSalesCount,
    revenueAllTime: netRevenue(allTimeRevenueAgg._sum),
    salesAllTime: allTimeSalesCount,
    activeClients,
    newClientsThisMonth,
    unitsInStock: stockAgg._sum.stock ?? 0,
  };
}
