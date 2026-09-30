import type { PrismaClient } from "@/lib/generated/prisma/client";
import type { TransactionClient } from "@/lib/generated/prisma/internal/prismaNamespace";
import {
  computeSessionTotals,
  type PaymentGroup,
  type SessionTotals,
} from "@/lib/shop/cash";

// Not a "use server" module: these take ids and productType as plain
// arguments, so only code that already resolved them from the caller's own
// scope may call them.

type Db = PrismaClient | TransactionClient;

async function walletProviders(db: Db, productType: string): Promise<string[]> {
  const wallets = await db.walletAccount.findMany({
    where: { productType },
    orderBy: { position: "asc" },
    select: { provider: true },
  });
  return wallets.map((wallet) => wallet.provider);
}

async function paymentGroups(
  db: Db,
  where: { cashSessionId: string },
): Promise<PaymentGroup[]> {
  const groups = await db.sale.groupBy({
    by: ["paymentMethod", "walletProvider"],
    // A refunded sale was still sold: its refund leaves the till on its
    // own (cashRefunds). Only a cancelled sale never happened.
    where: { ...where, status: { not: "CANCELLED" } },
    _sum: { total: true },
    _count: { _all: true },
  });
  return groups.map((group) => ({
    paymentMethod: group.paymentMethod,
    walletProvider: group.walletProvider,
    total: Number(group._sum.total ?? 0),
    count: group._count._all,
  }));
}

async function movementSums(
  db: Db,
  where: { sessionId: string },
) {
  const rows = await db.cashMovement.groupBy({
    by: ["type"],
    where,
    _sum: { amount: true },
  });
  const sum = (type: "IN" | "OUT") =>
    Number(rows.find((row) => row.type === type)?._sum.amount ?? 0);
  return { cashIn: sum("IN"), cashOut: sum("OUT") };
}

// The totals a session shows: frozen at close for a closed one (later
// changes to its sales never rewrite a closed till), live for an open one.
export async function sessionTotalsOf(
  db: Db,
  session: {
    id: string;
    productType: string;
    status: "OPEN" | "CLOSED";
    openingFloat: { toNumber(): number };
    closingSummary: unknown;
  },
): Promise<SessionTotals> {
  if (session.status === "CLOSED" && session.closingSummary) {
    return session.closingSummary as SessionTotals;
  }
  return loadSessionTotals(db, {
    id: session.id,
    productType: session.productType,
    openingFloat: session.openingFloat.toNumber(),
  });
}

// Live totals of one session, from its completed sales and its movements.
export async function loadSessionTotals(
  db: Db,
  session: { id: string; productType: string; openingFloat: number },
): Promise<SessionTotals> {
  const [groups, providers, movements, refunds] = await Promise.all([
    paymentGroups(db, { cashSessionId: session.id }),
    walletProviders(db, session.productType),
    movementSums(db, { sessionId: session.id }),
    db.refundRequest.aggregate({
      where: { cashSessionId: session.id, status: "APPROVED", paymentMethod: "cash" },
      _sum: { amount: true },
    }),
  ]);
  return computeSessionTotals({
    openingFloat: session.openingFloat,
    groups,
    walletProviders: providers,
    ...movements,
    cashRefunds: Number(refunds._sum.amount ?? 0),
  });
}

// Serializes the operations that decide which business day is still open —
// opening a till and closing the day — per boutique, so a till can't open
// on a day whose closure is committing at the same moment. NO KEY UPDATE:
// the two still exclude each other, but inserts that merely reference the
// boutique row (sales, orders, audit entries) aren't blocked by it.
export async function lockBoutiqueDay(tx: TransactionClient, productType: string): Promise<void> {
  await tx.$queryRaw`SELECT 1 FROM "StoreType" WHERE "key" = ${productType} FOR NO KEY UPDATE`;
}
