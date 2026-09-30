"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { saleSchema, type SaleInput } from "@/lib/validation/sale";
import { requireWritableAdminScope } from "@/lib/shop/admin-scope";
import { recordSale } from "@/lib/shop/record-sale";

export type SaleActionResult = { error?: string; saleId?: string };

export async function createSale(input: SaleInput): Promise<SaleActionResult> {
  const { admin, productType } = await requireWritableAdminScope();
  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "invalid" };
  }

  const result = await recordSale({ ...parsed.data, productType, sellerId: admin.id });
  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath("/admin/sales");
  revalidatePath("/admin/products");
  revalidatePath("/");
  return { saleId: result.saleId };
}

export async function cancelSale(saleId: string): Promise<{ error?: string }> {
  const { productType } = await requireWritableAdminScope();

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
        const exists = await tx.sale.findFirst({
          where: { id: saleId, productType },
          select: { id: true },
        });
        throw new Error(exists ? "alreadyCancelled" : "notFound");
      }

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
    });
  } catch (err) {
    if (err instanceof Error && ["notFound", "alreadyCancelled"].includes(err.message)) {
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
