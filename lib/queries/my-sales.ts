import { prisma } from "@/lib/prisma";
import { toPageNumber } from "@/lib/shop/pagination";
import { buildPaymentBreakdown, roundMoney } from "@/lib/shop/cash";
import { mySalesWhere, type MySalesFilters } from "@/lib/shop/my-sales-filters";

export const MY_SALES_PAGE_SIZE = 25;

// "Mes ventes": only the calling seller's sales in their own boutique
// (sellerId and productType come from the session, never the URL). The
// summary covers every sale matching the filters, not just this page;
// cancelled sales are listed but never counted as sold or collected.
export async function getMySales(
  productType: string,
  sellerId: string,
  filters: MySalesFilters,
  page = 1,
) {
  const currentPage = toPageNumber(page);
  const where = mySalesWhere(productType, sellerId, filters);
  const completedWhere = { ...where, status: "COMPLETED" as const };

  const [sales, count, groups, wallets] = await Promise.all([
    prisma.sale.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * MY_SALES_PAGE_SIZE,
      take: MY_SALES_PAGE_SIZE,
      select: {
        id: true,
        reference: true,
        createdAt: true,
        status: true,
        total: true,
        paymentMethod: true,
        walletProvider: true,
        client: { select: { fullName: true } },
        items: {
          select: {
            quantity: true,
            variant: { select: { size: true, color: true, product: { select: { name: true } } } },
          },
        },
      },
    }),
    prisma.sale.count({ where }),
    // Filtering on CANCELLED leaves nothing to sum — by design.
    where.status === "CANCELLED"
      ? Promise.resolve([])
      : prisma.sale.groupBy({
          by: ["paymentMethod", "walletProvider"],
          where: completedWhere,
          _sum: { total: true },
          _count: { _all: true },
        }),
    prisma.walletAccount.findMany({
      where: { productType },
      orderBy: { position: "asc" },
      select: { provider: true },
    }),
  ]);

  const breakdown = buildPaymentBreakdown(
    groups.map((group) => ({
      paymentMethod: group.paymentMethod,
      walletProvider: group.walletProvider,
      total: Number(group._sum.total ?? 0),
      count: group._count._all,
    })),
    wallets.map((wallet) => wallet.provider),
  );

  return {
    sales: sales.map((sale) => ({
      id: sale.id,
      reference: sale.reference,
      createdAt: sale.createdAt,
      status: sale.status,
      total: sale.total.toNumber(),
      paymentMethod: sale.paymentMethod,
      walletProvider: sale.walletProvider,
      clientName: sale.client?.fullName ?? null,
      items: sale.items.map((item) => ({
        name: item.variant.product.name,
        size: item.variant.size,
        color: item.variant.color,
        quantity: item.quantity,
      })),
    })),
    total: count,
    page: currentPage,
    summary: {
      // Same completed sales as the amounts next to it; the cancelled ones
      // in the filtered list are counted apart.
      salesCount: breakdown.reduce((sum, row) => sum + row.count, 0),
      cancelledCount: count - breakdown.reduce((sum, row) => sum + row.count, 0),
      soldTotal: roundMoney(breakdown.reduce((sum, row) => sum + row.total, 0)),
      breakdown,
    },
    walletProviders: wallets.map((wallet) => wallet.provider),
  };
}
