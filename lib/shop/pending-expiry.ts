import { prisma } from "@/lib/prisma";
import { sendOrderPush } from "@/lib/push/order-push";

// The cancelReason recorded on an order cancelled by the timer — a preset
// key (REASON_LABEL_KEY in lib/shop/client-messages.ts), translated where
// it's shown.
export const PAYMENT_TIMEOUT_REASON = "payment_timeout";

// One pass per run, so a backlog can't make a single run time out; the next
// run picks up what's left.
const BATCH_SIZE = 100;

// Cancels the PENDING orders older than their boutique's
// pendingAutoCancelHours: same restitution as an admin's reject (stock and
// promo redemption given back), status CANCELLED, push sent. Run by the cron
// route (app/api/cron/expire-pending-orders). Returns the references
// cancelled.
export async function cancelExpiredPendingOrders(now = new Date()): Promise<string[]> {
  const boutiques = await prisma.storeType.findMany({
    where: { pendingAutoCancelHours: { not: null } },
    select: { key: true, pendingAutoCancelHours: true },
  });

  const cancelled: { id: string; reference: string }[] = [];
  for (const boutique of boutiques) {
    const hours = boutique.pendingAutoCancelHours!;
    if (hours <= 0) continue;
    const expired = await prisma.order.findMany({
      where: {
        productType: boutique.key,
        status: "PENDING",
        createdAt: { lt: new Date(now.getTime() - hours * 3_600_000) },
      },
      orderBy: { createdAt: "asc" },
      take: BATCH_SIZE,
      select: { id: true },
    });

    for (const { id } of expired) {
      const order = await prisma.$transaction(async (tx) => {
        // The status flip is the gate, as in rejectOrder: an admin
        // validating this order at the same moment wins or loses cleanly,
        // and stock is never given back twice.
        const updated = await tx.order.updateMany({
          where: { id, status: "PENDING" },
          data: { status: "CANCELLED", cancelledAt: now, cancelReason: PAYMENT_TIMEOUT_REASON },
        });
        if (updated.count === 0) return null;

        const row = await tx.order.findUniqueOrThrow({ where: { id }, include: { items: true } });
        for (const item of row.items) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.quantity } },
          });
        }
        if (row.promoCodeId) {
          await tx.promoCode.update({
            where: { id: row.promoCodeId },
            data: { usedCount: { decrement: 1 } },
          });
        }
        return { id, reference: row.reference };
      });
      if (order) cancelled.push(order);
    }
  }

  for (const order of cancelled) {
    await sendOrderPush(order.id, "cancelled");
  }
  return cancelled.map((order) => order.reference);
}
