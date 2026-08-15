import { prisma } from "@/lib/prisma";

export const AUDIT_LOG_PAGE_SIZE = 50;

export async function getAuditLog(productType: string, filters: { page?: number } = {}) {
  const page = Math.max(1, filters.page ?? 1);

  const [entries, total] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where: { productType },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * AUDIT_LOG_PAGE_SIZE,
      take: AUDIT_LOG_PAGE_SIZE,
    }),
    prisma.adminAuditLog.count({ where: { productType } }),
  ]);

  return { entries, total, page };
}
