import { prisma } from "@/lib/prisma";

export async function getRevenueByDay(daysBack = 90) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);

  const rows = await prisma.$queryRaw<{ day: Date; total: number }[]>`
    SELECT date_trunc('day', "createdAt") AS day, SUM("total")::float AS total
    FROM "Sale"
    WHERE "status" = 'COMPLETED' AND "createdAt" >= ${cutoff}
    GROUP BY day
    ORDER BY day ASC
  `;

  return rows.map((row) => ({
    day: row.day.toISOString().slice(0, 10),
    total: Number(row.total),
  }));
}

export async function getBestSellers(limit = 5) {
  const grouped = await prisma.saleItem.groupBy({
    by: ["variantId"],
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

export async function getLowStockVariants() {
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
    WHERE v.stock <= v."lowStockThreshold"
    ORDER BY v.stock ASC
  `;
}

export async function getSummaryStats() {
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
    activeClients,
    newClientsThisMonth,
    stockAgg,
  ] = await Promise.all([
    prisma.sale.aggregate({
      where: { status: "COMPLETED", createdAt: { gte: startOfMonth } },
      _sum: { total: true },
    }),
    prisma.sale.count({
      where: { status: "COMPLETED", createdAt: { gte: startOfMonth } },
    }),
    prisma.sale.aggregate({
      where: {
        status: "COMPLETED",
        createdAt: { gte: startOfLastMonth, lt: startOfMonth },
      },
      _sum: { total: true },
    }),
    prisma.sale.count({
      where: {
        status: "COMPLETED",
        createdAt: { gte: startOfLastMonth, lt: startOfMonth },
      },
    }),
    prisma.client.count(),
    prisma.client.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.productVariant.aggregate({ _sum: { stock: true } }),
  ]);

  return {
    revenueThisMonth: revenueAgg._sum.total?.toNumber() ?? 0,
    revenueLastMonth: lastMonthRevenueAgg._sum.total?.toNumber() ?? 0,
    salesThisMonth: salesCount,
    salesLastMonth: lastMonthSalesCount,
    activeClients,
    newClientsThisMonth,
    unitsInStock: stockAgg._sum.stock ?? 0,
  };
}
