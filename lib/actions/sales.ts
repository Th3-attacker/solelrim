"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { saleSchema, type SaleInput } from "@/lib/validation/sale";
import { PrismaClientKnownRequestError } from "@/lib/generated/prisma/internal/prismaNamespace";
import { buildSaleReference } from "@/lib/shop/reference";
import { requireWritableAdminScope } from "@/lib/shop/admin-scope";

export type SaleActionResult = { error?: string; saleId?: string };

export async function createSale(input: SaleInput): Promise<SaleActionResult> {
  const { productType } = await requireWritableAdminScope();
  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "invalid" };
  }
  const { clientId, discount, paymentMethod, notes, items } = parsed.data;

  try {
    const saleId = await prisma.$transaction(async (tx) => {
      const variantIds = items.map((i) => i.variantId);
      const variants = await tx.productVariant.findMany({
        where: { id: { in: variantIds } },
        include: { product: true },
      });
      const variantById = new Map(variants.map((v) => [v.id, v]));

      // The sale-form variant picker only lists the current boutique's
      // variants, but guard against a stale tab / a different scope open
      // elsewhere the same way submitOrder guards the storefront cart.
      if (variants.some((v) => v.product.productType !== productType)) {
        throw new Error("invalid");
      }
      if (clientId) {
        const client = await tx.client.findFirst({
          where: { id: clientId, productType },
        });
        if (!client) throw new Error("invalid");
      }

      const lineItems = items.map((item) => {
        const variant = variantById.get(item.variantId);
        if (!variant) throw new Error("invalid");
        if (variant.stock < item.quantity) throw new Error("insufficientStock");
        const unitPrice = (variant.price ?? variant.product.basePrice).toNumber();
        return {
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice,
          lineTotal: unitPrice * item.quantity,
        };
      });

      // The lineItems check above reads stock once for a fast, clear error
      // on the obvious case — it isn't atomic on its own though, so also
      // re-assert stock >= quantity in the UPDATE's WHERE (same guard as
      // confirmOrder/promo codes) to close the race where two concurrent
      // sales/orders for the same variant both pass that read before
      // either commits.
      for (const item of items) {
        const updated = await tx.productVariant.updateMany({
          where: { id: item.variantId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (updated.count === 0) {
          throw new Error("insufficientStock");
        }
      }

      const subtotal = lineItems.reduce((sum, i) => sum + i.lineTotal, 0);
      const total = Math.max(subtotal - discount, 0);

      let attempt = 0;
      while (attempt < 3) {
        const reference = buildSaleReference();
        try {
          const sale = await tx.sale.create({
            data: {
              reference,
              clientId,
              subtotal,
              discount,
              total,
              paymentMethod,
              notes,
              productType,
              items: { create: lineItems },
            },
          });
          return sale.id;
        } catch (err) {
          if (err instanceof PrismaClientKnownRequestError && err.code === "P2002") {
            attempt++;
            continue;
          }
          throw err;
        }
      }
      throw new Error("referenceCollision");
    });

    revalidatePath("/admin/sales");
    revalidatePath("/admin/products");
    revalidatePath("/");
    return { saleId };
  } catch (err) {
    if (
      err instanceof Error &&
      ["invalid", "insufficientStock", "referenceCollision"].includes(err.message)
    ) {
      return { error: err.message };
    }
    throw err;
  }
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
