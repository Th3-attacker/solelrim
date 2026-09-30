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
      const sale = await tx.sale.findFirst({
        where: { id: saleId, productType },
        include: { items: true },
      });
      if (!sale) throw new Error("notFound");
      if (sale.status !== "COMPLETED") throw new Error("alreadyCancelled");

      for (const item of sale.items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
      }

      await tx.sale.update({ where: { id: saleId }, data: { status: "CANCELLED" } });
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
