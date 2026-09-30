import { prisma } from "@/lib/prisma";

export const AUDIT_LOG_PAGE_SIZE = 50;

export type AuditLogFilters = {
  page?: number;
  search?: string;
  action?: string;
  adminUserId?: string;
  dateFrom?: Date;
  dateTo?: Date;
};

// productType null = every boutique (superadmin only — see
// requireAuditLogScope); callers never pass a value straight from the URL
// for a boutique admin.
//
// Unlike getAllOrders, this is always page-limited (skip/take below), so an
// open-ended date range never costs more than one extra WHERE clause — no
// need for the max-range cap lib/orders/filters.ts imposes on order exports.
export async function getAuditLog(productType: string | null, filters: AuditLogFilters = {}) {
  const { search, action, adminUserId, dateFrom, dateTo } = filters;
  const page = Math.max(1, filters.page ?? 1);
  const where = {
    ...(productType && { productType }),
    ...(action && { action }),
    ...(adminUserId && { adminUserId }),
    ...(search && {
      OR: [
        { adminEmail: { contains: search, mode: "insensitive" as const } },
        { targetLabel: { contains: search, mode: "insensitive" as const } },
        { reason: { contains: search, mode: "insensitive" as const } },
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

// Everyone who appears in the log, for the "user" filter — read from the
// log itself so deleted accounts stay filterable.
export async function getAuditLogActors(productType: string | null) {
  const rows = await prisma.adminAuditLog.findMany({
    where: productType ? { productType } : {},
    distinct: ["adminUserId"],
    orderBy: [{ adminUserId: "asc" }, { createdAt: "desc" }],
    select: { adminUserId: true, adminEmail: true },
    take: 200,
  });
  return rows
    .map((row) => ({ id: row.adminUserId, email: row.adminEmail }))
    .sort((a, b) => a.email.localeCompare(b.email));
}
