"use server";

import { format } from "date-fns";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { saleSchema, type SaleInput } from "@/lib/validation/sale";
import { PrismaClientKnownRequestError } from "@/lib/generated/prisma/internal/prismaNamespace";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");
}

function buildSaleReference(): string {
  const datePart = format(new Date(), "yyyyMMdd");
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `INV-${datePart}-${randomPart}`;
}

export type SaleActionResult = { error?: string; saleId?: string };

export async function createSale(input: SaleInput): Promise<SaleActionResult> {
  await requireAdmin();
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

      for (const item of items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { decrement: item.quantity } },
        });
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
  await requireAdmin();

  try {
    await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
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
