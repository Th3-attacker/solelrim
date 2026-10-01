"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { PrismaClientKnownRequestError } from "@/lib/generated/prisma/internal/prismaNamespace";
import {
  requireWritableAdminScope,
  tryCheckoutScope,
} from "@/lib/shop/admin-scope";
import { getAuditActor, writeAuditLog } from "@/lib/audit";
import { computeRefund } from "@/lib/shop/refund";
import { loadSessionTotals } from "@/lib/shop/cash-session";
import {
  refundDecisionSchema,
  refundRejectionSchema,
  refundRequestSchema,
} from "@/lib/validation/refund";

// Thrown inside a transaction to roll it back, returned to the caller as a
// value (Next masks thrown action messages in production).
class RefundError extends Error {}

const REFUNDABLE_STATUSES = ["COMPLETED", "PARTIALLY_REFUNDED"] as const;

function revalidateRefunds(saleId: string) {
  revalidatePath("/admin/pos/refunds");
  revalidatePath(`/admin/pos/receipt/${saleId}`);
  revalidatePath(`/admin/sales/${saleId}`);
  revalidatePath("/admin/sales");
  revalidatePath("/admin/pos/my-sales");
}

export type RefundActionResult = { error?: string; requestId?: string };

// A seller (or admin) asks for a refund of some units of a sale of their
// boutique, with a reason. Only checks what can be checked now; approval
// re-checks everything under lock.
export async function requestRefund(
  input: unknown,
): Promise<RefundActionResult> {
  const scope = await tryCheckoutScope();
  if (scope.error) return { error: scope.error };
  const { admin, productType } = scope;
  const parsed = refundRequestSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid" };
  const { saleId, items, reason } = parsed.data;

  const sale = await prisma.sale.findFirst({
    where: { id: saleId, productType },
    include: { items: true },
  });
  if (!sale) return { error: "notFound" };
  if (!(REFUNDABLE_STATUSES as readonly string[]).includes(sale.status)) {
    return { error: "notRefundable" };
  }
  const requested = new Map(
    items.map((item) => [item.saleItemId, item.quantity]),
  );
  if (requested.size !== items.length) return { error: "invalid" };
  const refund = computeRefund({
    subtotal: sale.subtotal.toNumber(),
    total: sale.total.toNumber(),
    refundedAmount: sale.refundedAmount.toNumber(),
    loyaltyPointsEarned: 0,
    loyaltyPointsRedeemed: 0,
    previousPointsTakenBack: 0,
    previousPointsReturned: 0,
    lines: sale.items.map((line) => ({
      saleItemId: line.id,
      unitPrice: line.unitPrice.toNumber(),
      quantity: line.quantity,
      refundedQuantity: line.refundedQuantity,
      refundQuantity: requested.get(line.id) ?? 0,
    })),
  });
  // Also catches a saleItemId that isn't a line of this sale.
  if (
    !refund ||
    [...requested.keys()].some((id) => !sale.items.some((l) => l.id === id))
  ) {
    return { error: "invalidQuantity" };
  }

  const actor = await getAuditActor(admin);
  try {
    const request = await prisma.$transaction(async (tx) => {
      // Re-checked under the sale's lock: cancelSale and approveRefund take
      // the same lock, so a request can't slip onto a sale cancelled (or
      // fully refunded) since the read above.
      const [locked] = await tx.$queryRaw<{ status: string }[]>`
        SELECT "status"::text FROM "Sale" WHERE "id" = ${saleId} FOR UPDATE
      `;
      if (!locked || !(REFUNDABLE_STATUSES as readonly string[]).includes(locked.status)) {
        throw new RefundError("notRefundable");
      }
      const created = await tx.refundRequest.create({
        data: {
          productType,
          saleId,
          reason,
          requestedById: admin.id,
          requestedByEmail: actor.email,
          items: {
            create: items.map((item) => ({
              saleItemId: item.saleItemId,
              quantity: item.quantity,
            })),
          },
        },
      });
      await writeAuditLog(tx, actor, {
        productType,
        action: "refund.request",
        targetId: created.id,
        targetLabel: sale.reference,
        newValue: {
          items: items.reduce((sum, item) => sum + item.quantity, 0),
          estimatedAmount: refund.amount,
        },
        reason,
      });
      return created;
    });
    revalidateRefunds(saleId);
    return { requestId: request.id };
  } catch (err) {
    if (err instanceof RefundError) return { error: err.message };
    // RefundRequest_one_pending_per_sale
    if (err instanceof PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "alreadyPending" };
    }
    throw err;
  }
}

// The boutique admin (or superadmin) approves: in one transaction the units
// go back to stock, the money leaves the approver's till (cash) or is
// recorded as a wallet refund, loyalty points are prorated back, and the
// sale's status and refunded amount move on.
export async function approveRefund(
  input: unknown,
): Promise<RefundActionResult> {
  const { admin, productType } = await requireWritableAdminScope();
  const parsed = refundDecisionSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid" };
  const { requestId } = parsed.data;
  const actor = await getAuditActor(admin);

  try {
    const saleId = await prisma.$transaction(async (tx) => {
      // PENDING -> APPROVED first: the gate against a double approval.
      const gate = await tx.refundRequest.updateMany({
        where: { id: requestId, productType, status: "PENDING" },
        data: {
          status: "APPROVED",
          decidedById: admin.id,
          decidedByEmail: actor.email,
          decidedAt: new Date(),
        },
      });
      if (gate.count === 0) {
        const exists = await tx.refundRequest.findFirst({
          where: { id: requestId, productType },
          select: { id: true },
        });
        throw new RefundError(exists ? "alreadyDecided" : "notFound");
      }

      const request = await tx.refundRequest.findUniqueOrThrow({
        where: { id: requestId },
        include: { items: true },
      });
      // Locks the sale: two approvals on it (or an approval and a cancel)
      // run one after the other, each seeing the other's result.
      const [locked] = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Sale" WHERE "id" = ${request.saleId} FOR UPDATE
      `;
      if (!locked) throw new RefundError("notFound");
      const sale = await tx.sale.findUniqueOrThrow({
        where: { id: request.saleId },
        include: { items: true },
      });
      if (!(REFUNDABLE_STATUSES as readonly string[]).includes(sale.status)) {
        throw new RefundError("notRefundable");
      }

      const previous = await tx.refundRequest.aggregate({
        where: { saleId: sale.id, status: "APPROVED", id: { not: request.id } },
        _sum: { loyaltyPointsTakenBack: true, loyaltyPointsReturned: true },
      });
      const requested = new Map(
        request.items.map((item) => [item.saleItemId, item.quantity]),
      );
      const refund = computeRefund({
        subtotal: sale.subtotal.toNumber(),
        total: sale.total.toNumber(),
        refundedAmount: sale.refundedAmount.toNumber(),
        loyaltyPointsEarned: sale.loyaltyPointsEarned,
        loyaltyPointsRedeemed: sale.loyaltyPointsRedeemed,
        previousPointsTakenBack: previous._sum.loyaltyPointsTakenBack ?? 0,
        previousPointsReturned: previous._sum.loyaltyPointsReturned ?? 0,
        lines: sale.items.map((line) => ({
          saleItemId: line.id,
          unitPrice: line.unitPrice.toNumber(),
          quantity: line.quantity,
          refundedQuantity: line.refundedQuantity,
          refundQuantity: requested.get(line.id) ?? 0,
        })),
      });
      // Units refunded by another approval since the request was made.
      if (!refund) throw new RefundError("invalidQuantity");

      for (const item of request.items) {
        const line = sale.items.find((l) => l.id === item.saleItemId)!;
        // Guarded increment, on top of the sale lock and the CHECK
        // constraint: never beyond what was sold.
        const updated = await tx.saleItem.updateMany({
          where: {
            id: line.id,
            refundedQuantity: { lte: line.quantity - item.quantity },
          },
          data: { refundedQuantity: { increment: item.quantity } },
        });
        if (updated.count === 0) throw new RefundError("invalidQuantity");
        await tx.productVariant.update({
          where: { id: line.variantId },
          data: { stock: { increment: item.quantity } },
        });
      }

      // Cash comes out of the approver's own open till, which must hold it.
      let cashSessionId: string | null = null;
      if (sale.paymentMethod === "cash" && refund.amount > 0) {
        const [session] = await tx.$queryRaw<
          { id: string; openingFloat: string }[]
        >`
          SELECT "id", "openingFloat"::text FROM "CashSession"
          WHERE "sellerId" = ${admin.id} AND "productType" = ${productType} AND "status" = 'OPEN'
          FOR UPDATE
        `;
        if (!session) throw new RefundError("noOpenSession");
        const totals = await loadSessionTotals(tx, {
          id: session.id,
          productType,
          openingFloat: Number(session.openingFloat),
        });
        if (refund.amount > totals.expectedCash)
          throw new RefundError("insufficientCash");
        cashSessionId = session.id;
      }

      const pointsChange =
        refund.loyaltyPointsReturned - refund.loyaltyPointsTakenBack;
      if (sale.clientId && pointsChange !== 0) {
        const [client] = await tx.$queryRaw<{ loyaltyPoints: number }[]>`
          SELECT "loyaltyPoints" FROM "Client" WHERE "id" = ${sale.clientId} FOR UPDATE
        `;
        if (client) {
          await tx.client.update({
            where: { id: sale.clientId },
            // Floored like a cancellation: points already spent elsewhere
            // can't be taken back below zero.
            data: {
              loyaltyPoints: Math.max(client.loyaltyPoints + pointsChange, 0),
            },
          });
        }
      }

      await tx.sale.update({
        where: { id: sale.id },
        data: {
          refundedAmount: { increment: refund.amount },
          status: refund.allRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED",
        },
      });
      await tx.refundRequest.update({
        where: { id: request.id },
        data: {
          amount: refund.amount,
          paymentMethod: sale.paymentMethod,
          walletProvider: sale.walletProvider,
          cashSessionId,
          loyaltyPointsTakenBack: refund.loyaltyPointsTakenBack,
          loyaltyPointsReturned: refund.loyaltyPointsReturned,
        },
      });
      await writeAuditLog(tx, actor, {
        productType,
        action: "refund.approve",
        targetId: request.id,
        targetLabel: sale.reference,
        oldValue: {
          status: sale.status,
          refundedAmount: sale.refundedAmount.toNumber(),
        },
        newValue: {
          status: refund.allRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED",
          amount: refund.amount,
          paymentMethod: sale.paymentMethod,
          loyaltyPointsTakenBack: refund.loyaltyPointsTakenBack,
          loyaltyPointsReturned: refund.loyaltyPointsReturned,
        },
        reason: request.reason,
      });
      return sale.id;
    });
    revalidateRefunds(saleId);
    revalidatePath("/admin/pos/register");
    return { requestId };
  } catch (err) {
    if (err instanceof RefundError) return { error: err.message };
    throw err;
  }
}

export async function rejectRefund(
  input: unknown,
): Promise<RefundActionResult> {
  const { admin, productType } = await requireWritableAdminScope();
  const parsed = refundRejectionSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid" };
  const { requestId, reason } = parsed.data;
  const actor = await getAuditActor(admin);

  try {
    const saleId = await prisma.$transaction(async (tx) => {
      const gate = await tx.refundRequest.updateMany({
        where: { id: requestId, productType, status: "PENDING" },
        data: {
          status: "REJECTED",
          decidedById: admin.id,
          decidedByEmail: actor.email,
          decidedAt: new Date(),
          rejectionReason: reason,
        },
      });
      if (gate.count === 0) {
        const exists = await tx.refundRequest.findFirst({
          where: { id: requestId, productType },
          select: { id: true },
        });
        throw new RefundError(exists ? "alreadyDecided" : "notFound");
      }
      const request = await tx.refundRequest.findUniqueOrThrow({
        where: { id: requestId },
        include: { sale: { select: { id: true, reference: true } } },
      });
      await writeAuditLog(tx, actor, {
        productType,
        action: "refund.reject",
        targetId: request.id,
        targetLabel: request.sale.reference,
        oldValue: { status: "PENDING" },
        newValue: { status: "REJECTED" },
        reason,
      });
      return request.sale.id;
    });
    revalidateRefunds(saleId);
    return { requestId };
  } catch (err) {
    if (err instanceof RefundError) return { error: err.message };
    throw err;
  }
}
