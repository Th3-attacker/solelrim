"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCheckoutScope } from "@/lib/shop/admin-scope";
import { recordSale } from "@/lib/shop/record-sale";
import { posSaleSchema } from "@/lib/validation/pos";

export type PosSaleResult = {
  error?: string;
  saleId?: string;
  reference?: string;
  total?: number;
  change?: number;
};

// An in-store sale recorded at the checkout by a seller, a boutique admin,
// or a superadmin. The boutique always comes from the caller's own scope,
// prices and totals are recomputed server-side (recordSale), and the sale
// is stamped with who recorded it.
export async function createPosSale(input: unknown): Promise<PosSaleResult> {
  const { admin, productType } = await requireCheckoutScope();
  const parsed = posSaleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "invalid" };
  }
  const data = parsed.data;

  let walletProvider: string | null = null;
  if (data.paymentMethod === "wallet") {
    // Must be one of *this* boutique's wallet accounts — an id from another
    // boutique is rejected, not just ignored.
    const wallet = await prisma.walletAccount.findFirst({
      where: { id: data.walletAccountId, productType },
      select: { provider: true },
    });
    if (!wallet) {
      return { error: "invalid" };
    }
    walletProvider = wallet.provider;
  }

  const amountReceived = data.paymentMethod === "cash" ? data.amountReceived : null;

  const result = await recordSale({
    productType,
    sellerId: admin.id,
    clientId: null,
    discount: data.discount,
    paymentMethod: data.paymentMethod,
    walletProvider,
    amountReceived,
    items: data.items,
  });
  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath("/admin/pos");
  revalidatePath("/admin/sales");
  revalidatePath("/admin/products");
  revalidatePath("/");
  return {
    saleId: result.saleId,
    reference: result.reference,
    total: result.total,
    change: amountReceived != null ? amountReceived - result.total : undefined,
  };
}
