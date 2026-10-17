import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { getMySales } from "@/lib/queries/my-sales";
import { getPosWallets } from "@/lib/queries/pos";
import { getSaleRefunds, listRefundRequests, REFUNDS_PAGE_SIZE } from "@/lib/queries/refunds";
import {
  approveRefundCommand,
  rejectRefundCommand,
  requestRefundCommand,
} from "@/lib/services/refunds-commands";
import { cancelSaleCommand, updateSaleCommand } from "@/lib/services/sales-commands";
import { parseMySalesFilters } from "@/lib/shop/my-sales-filters";
import {
  adminMiddleware,
  staffMiddleware,
  writableAdminMiddleware,
  writableStaffMiddleware,
} from "~/server/admin-middleware";

// The boutique's sales and their refunds. Reading and correcting sales is an
// admin's job; asking for a refund is open to sellers too (from the
// receipt), deciding one is an admin's. The writes are the shared commands.

export const SALES_PAGE_SIZE = 25;
export const SALE_STATUSES = ["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED", "CANCELLED"] as const;

export const salesSearchSchema = z.object({
  q: z.string().trim().max(40).optional(),
  status: z.enum(SALE_STATUSES).optional(),
  page: z.number().int().min(1).max(10_000),
});

function salesWhere(
  productType: string,
  filters: { q?: string; status?: string },
): Prisma.SaleWhereInput {
  return {
    productType,
    ...(filters.status && { status: filters.status as (typeof SALE_STATUSES)[number] }),
    ...(filters.q && {
      OR: [
        { reference: { contains: filters.q, mode: "insensitive" } },
        { client: { fullName: { contains: filters.q, mode: "insensitive" } } },
        { client: { phone: { contains: filters.q.replace(/\s/g, "") } } },
      ],
    }),
  };
}

export const listSales = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .validator(salesSearchSchema)
  .handler(async ({ context: { productType }, data }) => {
    const where = salesWhere(productType, data);
    const kept = { productType, status: { not: "CANCELLED" as const } };
    const [rows, total, sums, completed, pendingRefunds] = await Promise.all([
      prisma.sale.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (data.page - 1) * SALES_PAGE_SIZE,
        take: SALES_PAGE_SIZE,
        select: {
          id: true,
          reference: true,
          createdAt: true,
          total: true,
          refundedAmount: true,
          status: true,
          paymentMethod: true,
          walletProvider: true,
          client: { select: { fullName: true } },
        },
      }),
      prisma.sale.count({ where }),
      // The strip above the list: all of the boutique's sales, not the page.
      prisma.sale.aggregate({
        where: kept,
        _sum: { total: true, refundedAmount: true },
        _count: true,
      }),
      prisma.sale.count({ where: { productType, status: "COMPLETED" } }),
      prisma.refundRequest.count({ where: { productType, status: "PENDING" } }),
    ]);
    const collected =
      (sums._sum.total?.toNumber() ?? 0) - (sums._sum.refundedAmount?.toNumber() ?? 0);
    return {
      rows: rows.map((row) => ({
        ...row,
        client: row.client?.fullName ?? null,
        total: row.total.toNumber(),
        refundedAmount: row.refundedAmount.toNumber(),
      })),
      total,
      pageSize: SALES_PAGE_SIZE,
      summary: {
        collected,
        completed,
        averageBasket: sums._count > 0 ? collected / sums._count : 0,
        refunded: sums._sum.refundedAmount?.toNumber() ?? 0,
        pendingRefunds,
      },
    };
  });

// Everything the sale's panel shows: the ticket, how it was paid, who rang
// it up, its refunds; and what an edit may offer (the boutique's wallets).
export const getSale = createServerFn({ method: "GET" })
  .middleware([staffMiddleware])
  .validator(z.object({ saleId: z.string().min(1).max(64) }))
  .handler(async ({ context: { admin, productType }, data }) => {
    const sale = await prisma.sale.findFirst({
      where: {
        id: data.saleId,
        productType,
        // A seller only reads the sales they rang up.
        ...(admin.role === "SELLER" && { sellerId: admin.id }),
      },
      include: {
        client: { select: { id: true, fullName: true, phone: true } },
        cashSession: { select: { status: true, sellerEmail: true } },
        items: {
          include: {
            variant: { select: { size: true, color: true, product: { select: { name: true } } } },
          },
        },
      },
    });
    if (!sale) return null;
    const [refunds, wallets] = await Promise.all([
      getSaleRefunds(sale.id, productType),
      admin.role === "SELLER" ? [] : getPosWallets(productType),
    ]);
    return {
      id: sale.id,
      reference: sale.reference,
      status: sale.status,
      createdAt: sale.createdAt,
      client: sale.client,
      sellerEmail: sale.cashSession?.sellerEmail ?? null,
      closedTill: sale.cashSession?.status === "CLOSED",
      paymentMethod: sale.paymentMethod,
      walletProvider: sale.walletProvider,
      amountReceived: sale.amountReceived?.toNumber() ?? null,
      subtotal: sale.subtotal.toNumber(),
      discount: sale.discount.toNumber(),
      loyaltyDiscount: sale.loyaltyDiscount.toNumber(),
      loyaltyPointsEarned: sale.loyaltyPointsEarned,
      loyaltyPointsRedeemed: sale.loyaltyPointsRedeemed,
      total: sale.total.toNumber(),
      refundedAmount: sale.refundedAmount.toNumber(),
      notes: sale.notes,
      items: sale.items.map((item) => ({
        id: item.id,
        name: item.variant.product.name,
        size: item.variant.size,
        color: item.variant.color,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toNumber(),
        lineTotal: item.lineTotal.toNumber(),
      })),
      refunds,
      wallets,
      canManage: admin.role !== "SELLER",
    };
  });

export const cancelSale = createServerFn({ method: "POST" })
  .middleware([writableAdminMiddleware])
  .validator((input: unknown) => input)
  .handler(({ context: { command }, data }) => cancelSaleCommand(command, data));

export const updateSale = createServerFn({ method: "POST" })
  .middleware([writableAdminMiddleware])
  .validator((input: unknown) => input)
  .handler(({ context: { command }, data }) => updateSaleCommand(command, data));

export const requestRefund = createServerFn({ method: "POST" })
  .middleware([writableStaffMiddleware])
  .validator((input: unknown) => input)
  .handler(({ context: { command }, data }) => requestRefundCommand(command, data));

export const approveRefund = createServerFn({ method: "POST" })
  .middleware([writableAdminMiddleware])
  .validator((input: unknown) => input)
  .handler(({ context: { command }, data }) => approveRefundCommand(command, data));

export const rejectRefund = createServerFn({ method: "POST" })
  .middleware([writableAdminMiddleware])
  .validator((input: unknown) => input)
  .handler(({ context: { command }, data }) => rejectRefundCommand(command, data));

export const REFUND_FILTERS = ["PENDING", "APPROVED", "REJECTED", "ALL"] as const;

// The refund requests: an admin sees the boutique's, a seller their own.
export const listRefunds = createServerFn({ method: "GET" })
  .middleware([staffMiddleware])
  .validator(
    z.object({ status: z.enum(REFUND_FILTERS), page: z.number().int().min(1).max(10_000) }),
  )
  .handler(async ({ context: { admin, productType }, data }) => ({
    ...(await listRefundRequests(
      productType,
      admin,
      data.status === "ALL" ? null : data.status,
      data.page,
    )),
    pageSize: REFUNDS_PAGE_SIZE,
    canDecide: admin.role !== "SELLER",
  }));

// Every sale the filters match, for a CSV. Read when asked.
export const exportSales = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .validator(salesSearchSchema.omit({ page: true }))
  .handler(async ({ context: { productType }, data }) => {
    const rows = await prisma.sale.findMany({
      where: salesWhere(productType, data),
      orderBy: { createdAt: "desc" },
      take: 5000,
      select: {
        reference: true,
        createdAt: true,
        total: true,
        refundedAmount: true,
        status: true,
        paymentMethod: true,
        walletProvider: true,
        client: { select: { fullName: true } },
      },
    });
    return rows.map((row) => ({
      ...row,
      client: row.client?.fullName ?? null,
      total: row.total.toNumber(),
      refundedAmount: row.refundedAmount.toNumber(),
    }));
  });

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// "Mes ventes": the filters as they read in the address.
export const mySalesSearchSchema = z.object({
  q: z.string().trim().max(40).optional().catch(undefined),
  status: z.enum(SALE_STATUSES).optional().catch(undefined),
  // "cash", or "wallet:<provider>".
  payment: z.string().max(60).optional().catch(undefined),
  from: day.optional().catch(undefined),
  to: day.optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1).default(1),
});

// The caller's own sales in their boutique: the seller comes from the
// session, the filters only narrow it.
export const listMySales = createServerFn({ method: "GET" })
  .middleware([staffMiddleware])
  .validator(mySalesSearchSchema)
  .handler(({ context: { admin, productType }, data: { page, ...filters } }) =>
    getMySales(productType, admin.id, parseMySalesFilters(filters), page),
  );
