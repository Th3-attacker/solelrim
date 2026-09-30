"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { PrismaClientKnownRequestError } from "@/lib/generated/prisma/internal/prismaNamespace";
import type { InputJsonObject } from "@/lib/generated/prisma/internal/prismaNamespace";
import { requireWritableAdminScope, tryCheckoutScope } from "@/lib/shop/admin-scope";
import { getAuditActor, writeAuditLog } from "@/lib/audit";
import {
  businessDateOf,
  cashDifference,
  combineSessionTotals,
  formatBusinessDate,
  parseBusinessDate,
  roundMoney,
} from "@/lib/shop/cash";
import { loadSessionTotals, lockBoutiqueDay, sessionTotalsOf } from "@/lib/shop/cash-session";
import {
  cashMovementSchema,
  closeSessionSchema,
  dayClosureSchema,
  openSessionSchema,
} from "@/lib/validation/cash-session";

// Thrown inside a transaction to roll it back, returned to the caller as a
// value (Next masks thrown action messages in production).
class CashError extends Error {}

function revalidateRegister() {
  revalidatePath("/admin/pos");
  revalidatePath("/admin/pos/register");
  revalidatePath("/admin/pos/sessions");
  revalidatePath("/admin/cash-closures");
}

export type CashActionResult = { error?: string; sessionId?: string };

// Anyone who can sell (seller or admin) opens their own till with a float.
// One open till per person (partial unique index), and never on a business
// day the boutique has already closed.
export async function openCashSession(input: unknown): Promise<CashActionResult> {
  const scope = await tryCheckoutScope();
  if (scope.error) return { error: scope.error };
  const { admin, productType } = scope;
  const parsed = openSessionSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid" };

  const actor = await getAuditActor(admin);
  const businessDate = businessDateOf(new Date());

  try {
    const session = await prisma.$transaction(async (tx) => {
      await lockBoutiqueDay(tx, productType);
      const closure = await tx.storeDayClosure.findUnique({
        where: { productType_businessDate: { productType, businessDate } },
        select: { id: true },
      });
      if (closure) throw new CashError("dayClosed");

      const created = await tx.cashSession.create({
        data: {
          productType,
          sellerId: admin.id,
          sellerEmail: actor.email,
          sellerRole: admin.role,
          openingFloat: parsed.data.openingFloat,
          businessDate,
        },
      });
      await writeAuditLog(tx, actor, {
        productType,
        action: "cash.open",
        targetId: created.id,
        targetLabel: actor.email,
        newValue: { openingFloat: parsed.data.openingFloat },
      });
      return created;
    });
    revalidateRegister();
    return { sessionId: session.id };
  } catch (err) {
    if (err instanceof CashError) return { error: err.message };
    if (err instanceof PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "alreadyOpen" };
    }
    throw err;
  }
}

// Money put into or taken out of the caller's own open till, with a reason.
// Taking out more than the till should hold is refused.
export async function addCashMovement(input: unknown): Promise<CashActionResult> {
  const scope = await tryCheckoutScope();
  if (scope.error) return { error: scope.error };
  const { admin, productType } = scope;
  const parsed = cashMovementSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid" };
  const { type, amount, reason } = parsed.data;

  const actor = await getAuditActor(admin);

  try {
    const sessionId = await prisma.$transaction(async (tx) => {
      // Locks the till so two movements (or a movement and the close)
      // can't both pass the balance check.
      const [session] = await tx.$queryRaw<{ id: string; openingFloat: string }[]>`
        SELECT "id", "openingFloat"::text FROM "CashSession"
        WHERE "sellerId" = ${admin.id} AND "productType" = ${productType} AND "status" = 'OPEN'
        FOR UPDATE
      `;
      if (!session) throw new CashError("noOpenSession");

      if (type === "OUT") {
        const totals = await loadSessionTotals(tx, {
          id: session.id,
          productType,
          openingFloat: Number(session.openingFloat),
        });
        if (amount > totals.expectedCash) throw new CashError("insufficientCash");
      }

      const movement = await tx.cashMovement.create({
        data: { sessionId: session.id, type, amount, reason, createdById: admin.id },
      });
      await writeAuditLog(tx, actor, {
        productType,
        action: type === "IN" ? "cash.in" : "cash.out",
        targetId: movement.id,
        targetLabel: actor.email,
        newValue: { amount },
        reason,
      });
      return session.id;
    });
    revalidateRegister();
    return { sessionId };
  } catch (err) {
    if (err instanceof CashError) return { error: err.message };
    throw err;
  }
}

// Closes a till against the cash actually counted. A seller closes only
// their own; a boutique admin (or superadmin) may close any till of the
// boutique — e.g. one a seller left open. A count that doesn't match needs
// an explanation.
export async function closeCashSession(input: unknown): Promise<CashActionResult> {
  const scope = await tryCheckoutScope();
  if (scope.error) return { error: scope.error };
  const { admin, productType } = scope;
  const parsed = closeSessionSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid" };
  const { sessionId, countedCash, note } = parsed.data;

  const actor = await getAuditActor(admin);
  const ownOnly = admin.role === "SELLER";

  try {
    await prisma.$transaction(async (tx) => {
      // The OPEN -> CLOSED flip comes first: it's the concurrency gate, and
      // its row lock waits for any sale still committing on this till
      // (recordSale holds a share lock on it), so the totals below include
      // every sale — and no sale can land on it afterwards.
      const updated = await tx.cashSession.updateMany({
        where: {
          id: sessionId,
          productType,
          status: "OPEN",
          ...(ownOnly && { sellerId: admin.id }),
        },
        data: { status: "CLOSED", closedAt: new Date(), closedById: admin.id },
      });
      if (updated.count === 0) {
        const exists = await tx.cashSession.findFirst({
          where: { id: sessionId, productType, ...(ownOnly && { sellerId: admin.id }) },
          select: { id: true },
        });
        throw new CashError(exists ? "alreadyClosed" : "notFound");
      }

      const session = await tx.cashSession.findUniqueOrThrow({ where: { id: sessionId } });
      const totals = await loadSessionTotals(tx, {
        id: session.id,
        productType,
        openingFloat: session.openingFloat.toNumber(),
      });
      const difference = cashDifference(countedCash, totals.expectedCash);
      if (difference !== 0 && !note) throw new CashError("noteRequired");

      await tx.cashSession.update({
        where: { id: sessionId },
        data: {
          expectedCash: totals.expectedCash,
          countedCash,
          cashDifference: difference,
          closingNote: note || null,
          closingSummary: totals as unknown as InputJsonObject,
        },
      });
      await writeAuditLog(tx, actor, {
        productType,
        action: "cash.close",
        targetId: session.id,
        targetLabel: session.sellerEmail,
        oldValue: { status: "OPEN" },
        newValue: {
          status: "CLOSED",
          expectedCash: totals.expectedCash,
          countedCash,
          cashDifference: difference,
        },
        reason: note || undefined,
      });
    });
    revalidateRegister();
    revalidatePath(`/admin/pos/sessions/${sessionId}`);
    return { sessionId };
  } catch (err) {
    if (err instanceof CashError) return { error: err.message };
    throw err;
  }
}

// The boutique admin's end-of-day closure: every till of that business day
// must be closed; their frozen totals are consolidated and frozen again as
// the day's record. Once per boutique per day.
export async function closeStoreDay(input: unknown): Promise<{ error?: string }> {
  const { admin, productType } = await requireWritableAdminScope();
  const parsed = dayClosureSchema.safeParse(input);
  const businessDate = parsed.success ? parseBusinessDate(parsed.data.date) : null;
  if (!businessDate || businessDate > businessDateOf(new Date())) return { error: "invalid" };

  const actor = await getAuditActor(admin);

  try {
    await prisma.$transaction(async (tx) => {
      await lockBoutiqueDay(tx, productType);
      const sessions = await tx.cashSession.findMany({
        where: { productType, businessDate },
      });
      if (sessions.length === 0) throw new CashError("noSessions");
      // Includes tills opened on an earlier day and left open overnight:
      // they would keep taking sales after this closure, so it wouldn't be
      // final. Once none is open, none can open on this day anymore.
      const openTill = await tx.cashSession.findFirst({
        where: { productType, status: "OPEN", businessDate: { lte: businessDate } },
        select: { id: true },
      });
      if (openTill) throw new CashError("openSessions");

      const day = combineSessionTotals(
        await Promise.all(sessions.map((session) => sessionTotalsOf(tx, session))),
      );
      const countedCash = roundMoney(
        sessions.reduce((sum, session) => sum + Number(session.countedCash ?? 0), 0),
      );
      const difference = cashDifference(countedCash, day.expectedCash);

      await tx.storeDayClosure.create({
        data: {
          productType,
          businessDate,
          closedById: admin.id,
          closedByEmail: actor.email,
          sessionCount: sessions.length,
          salesCount: day.salesCount,
          salesTotal: day.salesTotal,
          expectedCash: day.expectedCash,
          countedCash,
          cashDifference: difference,
          breakdown: day.breakdown as unknown as InputJsonObject[],
        },
      });
      await writeAuditLog(tx, actor, {
        productType,
        action: "cash.dayClose",
        targetLabel: formatBusinessDate(businessDate),
        newValue: {
          sessionCount: sessions.length,
          salesTotal: day.salesTotal,
          expectedCash: day.expectedCash,
          countedCash,
          cashDifference: difference,
        },
      });
    });
  } catch (err) {
    if (err instanceof CashError) return { error: err.message };
    if (err instanceof PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "alreadyClosed" };
    }
    throw err;
  }

  revalidatePath("/admin/cash-closures");
  return {};
}
