import { createMiddleware } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { prisma } from "@/lib/prisma";
import { ExpectedError } from "@/lib/errors";
import {
  ADMIN_SCOPE_COOKIE,
  assertLicenseWritable,
  resolveSuperAdminScope,
} from "@/lib/auth/scope-core";
import { loadSignIn } from "./session.server";

// The data boundary of the admin: every server function reading or writing
// a boutique's data goes through one of these, whatever the page around it
// checked. Same rules as lib/auth/scope.ts for the Next.js build.

// Any signed-in staff member (sellers included), and the boutique they act
// on: their own, or for a superadmin the one they picked.
export const staffMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const signIn = await loadSignIn();
  if (signIn.status !== "signedIn") throw new ExpectedError("unauthorized");
  const { admin, user } = signIn;

  const productType =
    admin.role === "SUPERADMIN"
      ? await resolveSuperAdminScope({
          requested: getCookie(ADMIN_SCOPE_COOKIE),
          storeTypeKeys: (
            await prisma.storeType.findMany({
              select: { key: true },
              orderBy: { createdAt: "asc" },
            })
          ).map((type) => type.key),
          liveProductType: async () =>
            (
              await prisma.storeSettings.findUnique({
                where: { id: "singleton" },
                select: { productType: true },
              })
            )?.productType ?? "",
        })
      : // A boutique admin or a seller is locked to their own boutique; the
        // database guarantees they have one.
        admin.productType!;

  // The name the admin gave, if any: greetings and the menu fall back to
  // the email address.
  const metadata = user.user_metadata ?? {};
  const name =
    typeof metadata.full_name === "string"
      ? metadata.full_name
      : typeof metadata.name === "string"
        ? metadata.name
        : null;

  return next({ context: { admin, email: user.email ?? "", name, productType } });
});

// Boutique admins and superadmins: everything but the checkout is closed to
// sellers.
export const adminMiddleware = createMiddleware({ type: "function" })
  .middleware([staffMiddleware])
  .server(({ next, context }) => {
    if (context.admin.role === "SELLER") throw new ExpectedError("forbidden");
    return next();
  });

// Admins changing a boutique's data: refused while its license is
// suspended, expired or cancelled (superadmins excepted). Hands over who is
// acting, for the audit trail.
export const writableAdminMiddleware = createMiddleware({ type: "function" })
  .middleware([adminMiddleware])
  .server(async ({ next, context }) => {
    await assertLicenseWritable(context.admin, context.productType);
    return next({
      context: {
        actor: { id: context.admin.id, role: context.admin.role, email: context.email },
      },
    });
  });

export const superAdminMiddleware = createMiddleware({ type: "function" })
  .middleware([staffMiddleware])
  .server(({ next, context }) => {
    if (context.admin.role !== "SUPERADMIN") throw new ExpectedError("forbidden");
    return next();
  });
