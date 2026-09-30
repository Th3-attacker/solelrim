import { prisma } from "@/lib/prisma";
import { toPageNumber } from "@/lib/shop/pagination";
import { combineSessionTotals, roundMoney, type BreakdownRow } from "@/lib/shop/cash";
import { sessionTotalsOf } from "@/lib/shop/cash-session";

// Every function here takes productType (and the viewer) already resolved
// from the caller's own scope — never from the URL.

export type SessionViewer = { id: string; role: "SUPERADMIN" | "BOUTIQUE_ADMIN" | "SELLER" };

// A seller only ever sees their own tills; an admin every till of the
// boutique.
function viewerFilter(viewer: SessionViewer) {
  return viewer.role === "SELLER" ? { sellerId: viewer.id } : {};
}

function decimal(value: { toNumber(): number } | null): number | null {
  return value === null ? null : value.toNumber();
}

export async function getOpenSession(sellerId: string, productType: string) {
  const session = await prisma.cashSession.findFirst({
    where: { sellerId, productType, status: "OPEN" },
    select: { id: true, openingFloat: true, openedAt: true },
  });
  return session && { ...session, openingFloat: session.openingFloat.toNumber() };
}

export async function getSessionView(
  sessionId: string,
  productType: string,
  viewer: SessionViewer,
) {
  const session = await prisma.cashSession.findFirst({
    where: { id: sessionId, productType, ...viewerFilter(viewer) },
    include: {
      movements: { orderBy: { createdAt: "desc" } },
      sales: {
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true,
          reference: true,
          createdAt: true,
          total: true,
          status: true,
          paymentMethod: true,
          walletProvider: true,
        },
      },
    },
  });
  if (!session) return null;

  const totals = await sessionTotalsOf(prisma, session);
  return {
    id: session.id,
    status: session.status,
    sellerId: session.sellerId,
    sellerEmail: session.sellerEmail,
    openedAt: session.openedAt,
    closedAt: session.closedAt,
    businessDate: session.businessDate,
    countedCash: decimal(session.countedCash),
    cashDifference: decimal(session.cashDifference),
    closingNote: session.closingNote,
    totals,
    movements: session.movements.map((movement) => ({
      id: movement.id,
      type: movement.type,
      amount: movement.amount.toNumber(),
      reason: movement.reason,
      createdAt: movement.createdAt,
    })),
    sales: session.sales.map((sale) => ({ ...sale, total: sale.total.toNumber() })),
  };
}

export const SESSIONS_PAGE_SIZE = 30;

export async function listSessions(productType: string, viewer: SessionViewer, page = 1) {
  const currentPage = toPageNumber(page);
  const where = { productType, ...viewerFilter(viewer) };
  const [sessions, total] = await Promise.all([
    prisma.cashSession.findMany({
      where,
      orderBy: { openedAt: "desc" },
      skip: (currentPage - 1) * SESSIONS_PAGE_SIZE,
      take: SESSIONS_PAGE_SIZE,
      select: {
        id: true,
        status: true,
        sellerEmail: true,
        openedAt: true,
        closedAt: true,
        openingFloat: true,
        expectedCash: true,
        countedCash: true,
        cashDifference: true,
      },
    }),
    prisma.cashSession.count({ where }),
  ]);
  return {
    sessions: sessions.map((session) => ({
      ...session,
      openingFloat: session.openingFloat.toNumber(),
      expectedCash: decimal(session.expectedCash),
      countedCash: decimal(session.countedCash),
      cashDifference: decimal(session.cashDifference),
    })),
    total,
    page: currentPage,
  };
}

// One business day of the boutique: each till with its totals (frozen if
// closed, live if still open), the day consolidated, and its closure if the
// admin already closed it.
export async function getDayView(productType: string, businessDate: Date) {
  const [sessions, closure] = await Promise.all([
    prisma.cashSession.findMany({
      where: { productType, businessDate },
      orderBy: { openedAt: "asc" },
    }),
    prisma.storeDayClosure.findUnique({
      where: { productType_businessDate: { productType, businessDate } },
    }),
  ]);

  const rows = await Promise.all(
    sessions.map(async (session) => ({
      id: session.id,
      status: session.status,
      sellerEmail: session.sellerEmail,
      openedAt: session.openedAt,
      closedAt: session.closedAt,
      countedCash: decimal(session.countedCash),
      cashDifference: decimal(session.cashDifference),
      totals: await sessionTotalsOf(prisma, session),
    })),
  );
  const consolidated = combineSessionTotals(rows.map((row) => row.totals));
  const countedCash = roundMoney(rows.reduce((sum, row) => sum + (row.countedCash ?? 0), 0));

  return {
    sessions: rows,
    consolidated,
    countedCash,
    openCount: rows.filter((row) => row.status === "OPEN").length,
    closure: closure && {
      closedAt: closure.closedAt,
      closedByEmail: closure.closedByEmail,
      sessionCount: closure.sessionCount,
      salesCount: closure.salesCount,
      salesTotal: closure.salesTotal.toNumber(),
      expectedCash: closure.expectedCash.toNumber(),
      countedCash: closure.countedCash.toNumber(),
      cashDifference: closure.cashDifference.toNumber(),
      breakdown: closure.breakdown as unknown as BreakdownRow[],
    },
  };
}

export async function listDayClosures(productType: string) {
  const closures = await prisma.storeDayClosure.findMany({
    where: { productType },
    orderBy: { businessDate: "desc" },
    take: 30,
    select: {
      id: true,
      businessDate: true,
      closedByEmail: true,
      sessionCount: true,
      salesTotal: true,
      cashDifference: true,
    },
  });
  return closures.map((closure) => ({
    ...closure,
    salesTotal: closure.salesTotal.toNumber(),
    cashDifference: closure.cashDifference.toNumber(),
  }));
}
