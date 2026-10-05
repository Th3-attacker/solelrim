import { prisma } from "@/lib/prisma";
import { PrismaClientKnownRequestError } from "@/lib/generated/prisma/internal/prismaNamespace";
import { buildSaleReference } from "@/lib/shop/reference";
import { writeAuditLog, type AuditActor } from "@/lib/audit";
import { closeStaleSessions } from "@/lib/shop/cash-session";

// Deliberately NOT a "use server" module: every export of one becomes a
// Server Action callable from the browser, and this takes productType as a
// plain argument. Only the actions that already resolved productType from
// the caller's own scope (lib/actions/sales.ts, lib/actions/pos.ts) may
// call it.

export type RecordSaleInput = {
  productType: string;
  // Who rang the sale up: stamped on it as its seller, and on its audit
  // entry.
  actor: AuditActor;
  // Where it was recorded, kept in the audit entry.
  channel: "pos" | "backOffice";
  clientId: string | null;
  discount: number;
  paymentMethod: string | null;
  walletProvider?: string | null;
  amountReceived?: number | null;
  // When set, the total the caller showed and collected — the sale is
  // refused if the server-computed total differs (see "totalChanged").
  expectedTotal?: number | null;
  // An enrolled loyalty client of this boutique: the sale is attached to
  // them, earns points, and (redeem) spends one reward for a discount.
  loyalty?: { clientId: string; redeem: boolean } | null;
  notes?: string;
  items: { variantId: string; quantity: number }[];
};

export type RecordSaleError =
  | "invalid"
  | "noOpenSession"
  | "insufficientStock"
  | "insufficientAmount"
  | "insufficientPoints"
  | "totalChanged"
  | "referenceCollision";

export type RecordSaleResult =
  | { error: RecordSaleError }
  | {
      saleId: string;
      reference: string;
      total: number;
      loyaltyPointsEarned: number;
      // The client's balance after this sale; null when no card was used.
      loyaltyPointsBalance: number | null;
    };

const KNOWN_ERRORS: ReadonlySet<string> = new Set<RecordSaleError>([
  "invalid",
  "noOpenSession",
  "insufficientStock",
  "insufficientAmount",
  "insufficientPoints",
  "totalChanged",
  "referenceCollision",
]);

// Prices always come from the database, never from the caller, stock is
// decremented atomically, and loyalty points are computed and moved here
// too — the whole sale commits or nothing does.
export async function recordSale(input: RecordSaleInput): Promise<RecordSaleResult> {
  const { productType, items, loyalty } = input;

  // A till forgotten for 24 h must not keep selling.
  await closeStaleSessions(productType);

  try {
    return await prisma.$transaction(async (tx) => {
      // No sale without the seller's own till open in this boutique. The
      // share lock holds the till open until this sale commits: closing it
      // (an UPDATE) waits for us, so its totals always include this sale,
      // and once closed, a sale arriving after sees no open till.
      const [session] = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "CashSession"
        WHERE "sellerId" = ${input.actor.id} AND "productType" = ${productType} AND "status" = 'OPEN'
        FOR SHARE
      `;
      if (!session) throw new Error("noOpenSession");

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

      // The card must belong to an *enrolled* client of this boutique, and
      // the boutique must still have loyalty switched on.
      let rule: {
        loyaltySpendPerPoint: number;
        loyaltyRewardPoints: number;
        loyaltyRewardValue: number;
      } | null = null;
      if (loyalty) {
        const [client, storeType] = await Promise.all([
          tx.client.findFirst({
            where: { id: loyalty.clientId, productType, loyaltyEnrolledAt: { not: null } },
            select: { id: true },
          }),
          tx.storeType.findUnique({
            where: { key: productType },
            select: {
              loyaltyEnabled: true,
              loyaltySpendPerPoint: true,
              loyaltyRewardPoints: true,
              loyaltyRewardValue: true,
            },
          }),
        ]);
        if (!client || !storeType?.loyaltyEnabled) throw new Error("invalid");
        rule = storeType;
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
      // A reward never discounts below zero; it still costs its full points,
      // so it isn't spent at all when there's nothing left to discount.
      const redeem = Boolean(loyalty?.redeem && rule) && subtotal - input.discount > 0;
      const loyaltyDiscount = redeem
        ? Math.min(rule!.loyaltyRewardValue, Math.max(subtotal - input.discount, 0))
        : 0;
      const pointsRedeemed = redeem ? rule!.loyaltyRewardPoints : 0;
      const total = Math.max(subtotal - input.discount - loyaltyDiscount, 0);

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

      let pointsEarned = 0;
      let pointsBalance: number | null = null;
      if (loyalty && rule) {
        if (pointsRedeemed > 0) {
          // Atomic spend: the balance check lives in the UPDATE's WHERE, so
          // two concurrent sales can't both spend the same points.
          const spent = await tx.client.updateMany({
            where: { id: loyalty.clientId, loyaltyPoints: { gte: pointsRedeemed } },
            data: { loyaltyPoints: { decrement: pointsRedeemed } },
          });
          if (spent.count === 0) throw new Error("insufficientPoints");
        }
        pointsEarned = Math.floor(total / rule.loyaltySpendPerPoint);
        const client = await tx.client.update({
          where: { id: loyalty.clientId },
          data: { loyaltyPoints: { increment: pointsEarned } },
          select: { loyaltyPoints: true },
        });
        pointsBalance = client.loyaltyPoints;
      }

      for (let attempt = 0; attempt < 3; attempt++) {
        const reference = buildSaleReference();
        try {
          const created = await tx.sale.create({
            data: {
              reference,
              clientId: loyalty?.clientId ?? input.clientId,
              subtotal,
              discount: input.discount,
              total,
              paymentMethod: input.paymentMethod,
              walletProvider: input.walletProvider ?? null,
              amountReceived: input.amountReceived ?? null,
              loyaltyPointsEarned: pointsEarned,
              loyaltyPointsRedeemed: pointsRedeemed,
              loyaltyDiscount,
              notes: input.notes,
              productType,
              sellerId: input.actor.id,
              cashSessionId: session.id,
              items: { create: lineItems },
            },
          });
          await writeAuditLog(tx, input.actor, {
            productType,
            action: "sale.create",
            targetId: created.id,
            targetLabel: reference,
            newValue: {
              channel: input.channel,
              total,
              discount: input.discount,
              loyaltyDiscount,
              paymentMethod: input.paymentMethod,
              walletProvider: input.walletProvider ?? null,
              itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
              loyaltyPointsEarned: pointsEarned,
              loyaltyPointsRedeemed: pointsRedeemed,
            },
          });
          return {
            saleId: created.id,
            reference,
            total,
            loyaltyPointsEarned: pointsEarned,
            loyaltyPointsBalance: pointsBalance,
          };
        } catch (err) {
          if (err instanceof PrismaClientKnownRequestError && err.code === "P2002") {
            continue;
          }
          throw err;
        }
      }
      throw new Error("referenceCollision");
    });
  } catch (err) {
    if (err instanceof Error && KNOWN_ERRORS.has(err.message)) {
      return { error: err.message as RecordSaleError };
    }
    throw err;
  }
}
