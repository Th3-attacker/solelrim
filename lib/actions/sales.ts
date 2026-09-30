"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { saleSchema, type SaleInput } from "@/lib/validation/sale";
import { requireWritableAdminScope } from "@/lib/shop/admin-scope";
import { recordSale } from "@/lib/shop/record-sale";
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

export async function cancelSale(saleId: string): Promise<{ error?: string }> {
  const { admin, productType } = await requireWritableAdminScope();
  const actor = await getAuditActor(admin);

  try {
    await prisma.$transaction(async (tx) => {
      // Atomic COMPLETED -> CANCELLED first: this is the concurrency gate,
      // so two concurrent cancels (a double-click, two tabs) can't both
      // restock and both reverse points.
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
        include: { items: true },
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
        },
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
