import { prisma } from "@/lib/prisma";

export const AUDIT_LOG_PAGE_SIZE = 50;

export type AuditLogFilters = {
  page?: number;
  search?: string;
  action?: string;
  dateFrom?: Date;
  dateTo?: Date;
};

// Unlike getAllOrders, this is always page-limited (skip/take below), so an
// open-ended date range never costs more than one extra WHERE clause — no
// need for the max-range cap lib/orders/filters.ts imposes on order exports.
export async function getAuditLog(productType: string, filters: AuditLogFilters = {}) {
  const { search, action, dateFrom, dateTo } = filters;
  const page = Math.max(1, filters.page ?? 1);
  const where = {
    productType,
    ...(action && { action }),
    ...(search && {
      OR: [
        { adminEmail: { contains: search, mode: "insensitive" as const } },
        { targetLabel: { contains: search, mode: "insensitive" as const } },
      ],
    }),
    ...((dateFrom || dateTo) && {
      createdAt: {
        ...(dateFrom && { gte: dateFrom }),
        ...(dateTo && { lte: dateTo }),
      },
    }),
  };

  const [entries, total] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * AUDIT_LOG_PAGE_SIZE,
      take: AUDIT_LOG_PAGE_SIZE,
    }),
    prisma.adminAuditLog.count({ where }),
  ]);

  return { entries, total, page };
}
