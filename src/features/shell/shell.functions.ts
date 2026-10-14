import { createServerFn } from "@tanstack/react-start";
import { setCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ExpectedError } from "@/lib/errors";
import { ADMIN_SCOPE_COOKIE } from "@/lib/auth/scope-core";
import { getPendingOrderCount } from "@/lib/queries/orders";
import { countPendingRefunds } from "@/lib/queries/refunds";
import { getSiteUrl } from "@/lib/shop/site-url";
import { staffMiddleware, superAdminMiddleware } from "~/server/admin-middleware";

// What the frame around every admin page shows: who is signed in, the
// boutique they act on (and for a superadmin, the others), and the counts
// on the menu's badges.
export const getShell = createServerFn({ method: "GET" })
  .middleware([staffMiddleware])
  .handler(async ({ context: { admin, email, name, productType } }) => {
    const isSeller = admin.role === "SELLER";
    const [boutiques, pendingOrders, pendingRefunds] = await Promise.all([
      prisma.storeType.findMany({
        // Others' boutiques are only listed for whoever may switch to them.
        where: admin.role === "SUPERADMIN" ? {} : { key: productType },
        select: { key: true, label: true, domain: true },
        orderBy: { createdAt: "asc" },
      }),
      isSeller ? 0 : getPendingOrderCount(productType),
      // Only an admin decides refunds, so only they get that badge.
      isSeller ? 0 : countPendingRefunds(productType),
    ]);

    return {
      admin: { email, name, role: admin.role },
      boutique: boutiques.find((boutique) => boutique.key === productType) ?? {
        key: productType,
        label: productType,
        domain: null,
      },
      boutiques,
      // Where "Voir la boutique" leads: its own domain, else its path on the
      // main site.
      siteUrl: getSiteUrl(),
      counts: { pendingOrders, pendingRefunds },
    };
  });

// A superadmin switching the boutique they manage. A boutique admin is
// locked to theirs: the cookie is never read for them.
export const setAdminScope = createServerFn({ method: "POST" })
  .middleware([superAdminMiddleware])
  .validator(z.object({ key: z.string().min(1) }))
  .handler(async ({ data: { key } }) => {
    const boutique = await prisma.storeType.findUnique({ where: { key }, select: { key: true } });
    if (!boutique) throw new ExpectedError("forbidden");

    setCookie(ADMIN_SCOPE_COOKIE, key, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      secure: process.env.NODE_ENV === "production",
    });
  });
