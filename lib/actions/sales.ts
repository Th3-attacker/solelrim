"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { saleSchema, type SaleInput } from "@/lib/validation/sale";
import { requireWritableAdminScope } from "@/lib/shop/admin-scope";
import { recordSale } from "@/lib/shop/record-sale";
import { saleEditSchema } from "@/lib/validation/sale-edit";
import { saleCancelSchema } from "@/lib/validation/sale-cancel";
import { getAuditActor, writeAuditLog } from "@/lib/audit";

export type SaleActionResult = { error?: string; saleId?: string };

export async function createSale(input: SaleInput): Promise<SaleActionResult> {
  const { admin, productType } = await requireWritableAdminScope();
  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "invalid" };
  }

  const result = await recordSale({
    ...parsed.data,
    productType,
    actor: await getAuditActor(admin),
    channel: "backOffice",
  });
  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath("/admin/sales");
  revalidatePath("/admin/products");
  revalidatePath("/");
  return { saleId: result.saleId };
}

export async function cancelSale(input: unknown): Promise<{ error?: string }> {
  const { admin, productType } = await requireWritableAdminScope();
  const parsed = saleCancelSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid" };
  const { saleId, reason } = parsed.data;
  const actor = await getAuditActor(admin);

  try {
    await prisma.$transaction(async (tx) => {
      // Atomic COMPLETED -> CANCELLED first: this is the concurrency gate,
      // so two concurrent cancels (a double-click, two tabs) can't both
      // restock and both reverse points. Its row lock also serializes it
      // with requestRefund/approveRefund, which lock the same sale.
      const updated = await tx.sale.updateMany({
        where: { id: saleId, productType, status: "COMPLETED" },
        data: { status: "CANCELLED" },
      });
      if (updated.count === 0) {
        const existing = await tx.sale.findFirst({
          where: { id: saleId, productType },
          select: { status: true },
        });
        throw new Error(
          !existing ? "notFound" : existing.status === "CANCELLED" ? "alreadyCancelled" : "refunded",
        );
      }
      // A pending refund would be approved against a voided sale: it has to
      // be decided (or rejected) first.
      const pendingRefund = await tx.refundRequest.findFirst({
        where: { saleId, status: "PENDING" },
        select: { id: true },
      });
      if (pendingRefund) throw new Error("pendingRefund");

      const sale = await tx.sale.findUniqueOrThrow({
        where: { id: saleId },
        include: { items: true, cashSession: { select: { status: true } } },
      });

      for (const item of sale.items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
      }

      // Undo exactly what the sale did to the card: take back the points it
      // earned, give back the ones it spent. Floored at zero — if the
      // customer already spent the earned points, the balance can't go
      // negative. The row lock keeps a concurrent sale on the same card from
      // interleaving with this read-then-write.
      const pointsChange = sale.loyaltyPointsRedeemed - sale.loyaltyPointsEarned;
      if (sale.clientId && pointsChange !== 0) {
        const [client] = await tx.$queryRaw<{ loyaltyPoints: number }[]>`
          SELECT "loyaltyPoints" FROM "Client" WHERE "id" = ${sale.clientId} FOR UPDATE
        `;
        if (client) {
          await tx.client.update({
            where: { id: sale.clientId },
            data: { loyaltyPoints: Math.max(client.loyaltyPoints + pointsChange, 0) },
          });
        }
      }

      await writeAuditLog(tx, actor, {
        productType,
        action: "sale.cancel",
        targetId: sale.id,
        targetLabel: sale.reference,
        oldValue: { status: "COMPLETED" },
        newValue: {
          status: "CANCELLED",
          restockedItems: sale.items.reduce((sum, i) => sum + i.quantity, 0),
          loyaltyPointsChange: pointsChange,
          // The till's figures were frozen at its close: the cancellation
          // isn't in them, so the history says so (same as updateSale).
          ...(sale.cashSession?.status === "CLOSED" && { closedTill: true }),
        },
        reason,
      });
    });
  } catch (err) {
    if (
      err instanceof Error &&
      ["notFound", "alreadyCancelled", "refunded", "pendingRefund"].includes(err.message)
    ) {
      return { error: err.message };
    }
    throw err;
  }

  revalidatePath("/admin/sales");
  revalidatePath(`/admin/sales/${saleId}`);
  revalidatePath("/admin/products");
  revalidatePath("/");
  return {};
}

class SaleEditError extends Error {}

// An admin corrects a recorded sale's payment method, client or note —
// never its items or amounts. Every change needs a reason, and the audit
// entry keeps the old and new value of each field that changed.
export async function updateSale(input: unknown): Promise<{ error?: string }> {
  const { admin, productType } = await requireWritableAdminScope();
  const parsed = saleEditSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid" };
  const data = parsed.data;
  const actor = await getAuditActor(admin);

  try {
    await prisma.$transaction(async (tx) => {
      // Locked like cancelSale and the refund actions, so an edit can't
      // interleave with them.
      const [locked] = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Sale" WHERE "id" = ${data.saleId} AND "productType" = ${productType} FOR UPDATE
      `;
      if (!locked) throw new SaleEditError("notFound");
      const sale = await tx.sale.findUniqueOrThrow({
        where: { id: data.saleId },
        include: {
          client: { select: { fullName: true } },
          cashSession: { select: { status: true } },
          refundRequests: { where: { status: { in: ["PENDING", "APPROVED"] } }, select: { id: true } },
        },
      });
      if (sale.status === "CANCELLED") throw new SaleEditError("notEditable");

      // Both belong to this boutique, or the edit is refused.
      const wallet =
        data.paymentMethod === "wallet"
          ? await tx.walletAccount.findFirst({
              where: { id: data.walletAccountId!, productType },
              select: { provider: true },
            })
          : null;
      if (data.paymentMethod === "wallet" && !wallet) throw new SaleEditError("invalid");
      const client = data.clientId
        ? await tx.client.findFirst({
            where: { id: data.clientId, productType },
            select: { fullName: true },
          })
        : null;
      if (data.clientId && !client) throw new SaleEditError("invalid");

      const next = {
        paymentMethod: data.paymentMethod ?? sale.paymentMethod,
        walletProvider: data.paymentMethod ? (wallet?.provider ?? null) : sale.walletProvider,
        clientId: data.clientId,
        notes: data.notes || null,
      };
      const paymentChanged =
        next.paymentMethod !== sale.paymentMethod || next.walletProvider !== sale.walletProvider;
      const clientChanged = next.clientId !== sale.clientId;
      const notesChanged = next.notes !== (sale.notes || null);
      if (!paymentChanged && !clientChanged && !notesChanged) {
        throw new SaleEditError("noChanges");
      }
      // A refund already went back (or is about to) by the recorded
      // method, and loyalty points are tied to the recorded client:
      // changing either would leave those records wrong.
      if (paymentChanged && sale.refundRequests.length > 0) {
        throw new SaleEditError("paymentLocked");
      }
      if (
        clientChanged &&
        (sale.loyaltyPointsEarned > 0 || sale.loyaltyPointsRedeemed > 0)
      ) {
        throw new SaleEditError("clientLocked");
      }

      await tx.sale.update({
        where: { id: sale.id },
        data: {
          ...next,
          // The cash handed over only means something for a cash sale
          // recorded as such.
          ...(paymentChanged && { amountReceived: null }),
        },
      });

      const oldValue: Record<string, string | null> = {};
      const newValue: Record<string, string | boolean | null> = {};
      if (paymentChanged) {
        oldValue.paymentMethod = sale.paymentMethod;
        newValue.paymentMethod = next.paymentMethod;
        oldValue.walletProvider = sale.walletProvider;
        newValue.walletProvider = next.walletProvider;
      }
      if (clientChanged) {
        oldValue.client = sale.client?.fullName ?? null;
        newValue.client = client?.fullName ?? null;
      }
      if (notesChanged) {
        oldValue.notes = sale.notes || null;
        newValue.notes = next.notes;
      }
      // The till's figures were frozen at its close: the change isn't in
      // them, so the history says so.
      if (sale.cashSession?.status === "CLOSED") {
        newValue.closedTill = true;
      }
      await writeAuditLog(tx, actor, {
        productType,
        action: "sale.update",
        targetId: sale.id,
        targetLabel: sale.reference,
        oldValue,
        newValue,
        reason: data.reason,
      });
    });
  } catch (err) {
    if (err instanceof SaleEditError) return { error: err.message };
    throw err;
  }

  revalidatePath("/admin/sales");
  revalidatePath(`/admin/sales/${parsed.data.saleId}`);
  revalidatePath(`/admin/pos/receipt/${parsed.data.saleId}`);
  revalidatePath("/admin/pos/my-sales");
  return {};
}
