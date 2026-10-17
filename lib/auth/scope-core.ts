import { prisma } from "@/lib/prisma";
import { ExpectedError } from "@/lib/errors";
import { DEFAULT_PRODUCT_TYPE } from "@/lib/shop/product-type";
import { getEffectiveLicenseState, isLicenseBlocking } from "@/lib/shop/license";
import type { AdminUser } from "@/lib/generated/prisma/client";

// Which boutique a superadmin is acting on, free of any framework: the
// Next.js build (lib/auth/scope.ts) and the TanStack Start one each read the
// cookie their own way and pass it in.
export const ADMIN_SCOPE_COOKIE = "admin_store_scope";

// The boutique they picked (cookie) if it still exists, else the one live
// on the site, else the first one. The live one is only read when needed.
export async function resolveSuperAdminScope({
  requested,
  storeTypeKeys,
  liveProductType,
}: {
  requested: string | undefined;
  storeTypeKeys: readonly string[];
  liveProductType: () => Promise<string>;
}): Promise<string> {
  if (requested && storeTypeKeys.includes(requested)) return requested;
  const live = await liveProductType();
  if (storeTypeKeys.includes(live)) return live;
  return storeTypeKeys[0] ?? DEFAULT_PRODUCT_TYPE;
}

// Writes to a boutique whose license is suspended, expired or cancelled are
// refused, except a superadmin's (who is how it gets fixed).
export async function assertLicenseWritable(
  admin: Pick<AdminUser, "role">,
  productType: string,
): Promise<void> {
  if (admin.role === "SUPERADMIN") return;

  const storeType = await prisma.storeType.findUnique({
    where: { key: productType },
    select: { licenseType: true, licenseStatus: true, licenseExpiresAt: true },
  });
  if (!storeType) return;

  if (isLicenseBlocking(getEffectiveLicenseState(storeType))) {
    // The error pages tell "your boutique is suspended/expired" apart from
    // a bug by this code (lib/errors.ts).
    throw new ExpectedError("licenseBlocked");
  }
}
