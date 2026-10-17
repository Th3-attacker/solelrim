import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getOpenSession } from "@/lib/queries/cash-sessions";
import { getPosCatalog, getPosLoyaltyRule, getPosWallets, getReceipt } from "@/lib/queries/pos";
import { createPosSaleCommand } from "@/lib/services/pos-commands";
import {
  enrollLoyaltyCardCommand,
  lookupLoyaltyCardCommand,
} from "@/lib/services/loyalty-commands";
import { staffMiddleware, writableStaffMiddleware } from "~/server/admin-middleware";

// The checkout: what it sells, the sale itself, the loyalty card, the
// receipt. Sellers, boutique admins and superadmins alike, on the boutique
// their session resolves to. The input of a write is checked by the shared
// command itself (lib/validation/pos.ts), the same rules as the Next.js build.

// The caller's till, and everything the checkout screen needs once it is
// open. The whole catalog travels at once: it is small, and searching it on
// the device answers every keystroke at the counter without a round trip.
export const getCheckout = createServerFn({ method: "GET" })
  .middleware([staffMiddleware])
  .handler(async ({ context: { admin, productType } }) => {
    const session = await getOpenSession(admin.id, productType);
    if (!session) {
      // How the caller's last till ended, as a reminder when opening the next.
      const last = await prisma.cashSession.findFirst({
        where: { sellerId: admin.id, productType, status: "CLOSED" },
        orderBy: { closedAt: "desc" },
        select: { closedAt: true, countedCash: true, cashDifference: true },
      });
      return {
        open: false as const,
        lastClosed: last && {
          closedAt: last.closedAt,
          countedCash: last.countedCash?.toNumber() ?? null,
          cashDifference: last.cashDifference?.toNumber() ?? null,
        },
      };
    }
    const [products, wallets, loyaltyRule] = await Promise.all([
      getPosCatalog(productType),
      getPosWallets(productType),
      getPosLoyaltyRule(productType),
    ]);
    return { open: true as const, session, products, wallets, loyaltyRule };
  });

// Prices, totals and points are recomputed on the server; the total the
// seller saw must match or the sale is refused ("totalChanged").
export const sell = createServerFn({ method: "POST" })
  .middleware([writableStaffMiddleware])
  .validator((input: unknown) => input)
  .handler(({ context: { command }, data }) => createPosSaleCommand(command, data));

export const lookupLoyaltyCard = createServerFn({ method: "GET" })
  .middleware([writableStaffMiddleware])
  .validator(z.object({ phone: z.string().max(20) }))
  .handler(({ context: { command }, data }) => lookupLoyaltyCardCommand(command, data.phone));

export const enrollLoyaltyCard = createServerFn({ method: "POST" })
  .middleware([writableStaffMiddleware])
  .validator((input: unknown) => input)
  .handler(({ context: { command }, data }) => enrollLoyaltyCardCommand(command, data));

// What the printed or WhatsApp receipt shows. Reading a past sale isn't a
// write: a suspended boutique can still hand a customer a copy.
export const getSaleReceipt = createServerFn({ method: "GET" })
  .middleware([staffMiddleware])
  .validator(z.object({ saleId: z.string().min(1).max(64) }))
  .handler(({ context: { productType }, data }) => getReceipt(data.saleId, productType));
