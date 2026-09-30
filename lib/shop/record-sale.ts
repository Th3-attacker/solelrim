import { prisma } from "@/lib/prisma";
import { PrismaClientKnownRequestError } from "@/lib/generated/prisma/internal/prismaNamespace";
import { buildSaleReference } from "@/lib/shop/reference";

// Deliberately NOT a "use server" module: every export of one becomes a
// Server Action callable from the browser, and this takes productType as a
// plain argument. Only the actions that already resolved productType from
// the caller's own scope (lib/actions/sales.ts, lib/actions/pos.ts) may
// call it.

export type RecordSaleInput = {
  productType: string;
  sellerId: string | null;
  clientId: string | null;
  discount: number;
  paymentMethod: string | null;
  walletProvider?: string | null;
  amountReceived?: number | null;
  // When set, the total the caller showed and collected — the sale is
  // refused if the server-computed total differs (see "totalChanged").
  expectedTotal?: number | null;
  notes?: string;
  items: { variantId: string; quantity: number }[];
};

export type RecordSaleError =
  | "invalid"
  | "insufficientStock"
  | "insufficientAmount"
  | "totalChanged"
  | "referenceCollision";

export type RecordSaleResult =
  | { error: RecordSaleError }
  | { saleId: string; reference: string; total: number };

const KNOWN_ERRORS: ReadonlySet<string> = new Set<RecordSaleError>([
  "invalid",
  "insufficientStock",
  "insufficientAmount",
  "totalChanged",
  "referenceCollision",
]);

// Prices always come from the database, never from the caller, and stock is
// decremented atomically — the whole sale commits or nothing does.
export async function recordSale(input: RecordSaleInput): Promise<RecordSaleResult> {
  const { productType, items } = input;

  try {
    const sale = await prisma.$transaction(async (tx) => {
      const variants = await tx.productVariant.findMany({
        where: { id: { in: items.map((i) => i.variantId) } },
        include: { product: true },
      });
      const variantById = new Map(variants.map((v) => [v.id, v]));

      // The UI only ever lists the current boutique's variants, but guard
      // against a stale tab or a crafted request the same way submitOrder
      // guards the storefront cart.
      if (variants.some((v) => v.product.productType !== productType)) {
        throw new Error("invalid");
      }
      if (input.clientId) {
        const client = await tx.client.findFirst({
          where: { id: input.clientId, productType },
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

      // The stock read above gives a fast, clear error for the obvious case
      // but isn't atomic on its own — re-asserting stock >= quantity in the
      // UPDATE's WHERE closes the race where two concurrent sales/orders for
      // the same variant both pass that read before either commits.
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
      const total = Math.max(subtotal - input.discount, 0);

      // Both checked against the server-computed total, inside the
      // transaction, so a refused sale rolls the stock decrement back too.
      // A mismatch with the caller's total means a price changed since
      // their screen loaded: refuse rather than record an amount different
      // from what the customer was shown and paid.
      if (input.expectedTotal != null && Math.abs(input.expectedTotal - total) > 0.005) {
        throw new Error("totalChanged");
      }
      if (input.amountReceived != null && input.amountReceived < total) {
        throw new Error("insufficientAmount");
      }

      for (let attempt = 0; attempt < 3; attempt++) {
        const reference = buildSaleReference();
        try {
          const created = await tx.sale.create({
            data: {
              reference,
              clientId: input.clientId,
              subtotal,
              discount: input.discount,
              total,
              paymentMethod: input.paymentMethod,
              walletProvider: input.walletProvider ?? null,
              amountReceived: input.amountReceived ?? null,
              notes: input.notes,
              productType,
              sellerId: input.sellerId,
              items: { create: lineItems },
            },
          });
          return { saleId: created.id, reference, total };
        } catch (err) {
          if (err instanceof PrismaClientKnownRequestError && err.code === "P2002") {
            continue;
          }
          throw err;
        }
      }
      throw new Error("referenceCollision");
    });
    return sale;
  } catch (err) {
    if (err instanceof Error && KNOWN_ERRORS.has(err.message)) {
      return { error: err.message as RecordSaleError };
    }
    throw err;
  }
}
