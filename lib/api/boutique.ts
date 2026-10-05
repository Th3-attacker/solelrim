import { prisma } from "@/lib/prisma";
import { getEffectiveLicenseState, isLicenseBlocking } from "@/lib/shop/license";
import { fail } from "@/lib/api/http";

const BOUTIQUE_INCLUDE = {
  socialLinks: { orderBy: { position: "asc" as const } },
  walletAccounts: { orderBy: { position: "asc" as const } },
};

// The boutique an /api/v1/boutiques/[key]/... call targets. The key comes
// straight from the URL, so it is only trusted once matched against the real
// registry; a boutique whose license is suspended, expired or cancelled is
// closed to the app exactly as it is to the website.
export async function loadOpenBoutique(key: string) {
  const boutique = await prisma.storeType.findUnique({
    where: { key },
    include: BOUTIQUE_INCLUDE,
  });
  if (!boutique) return { response: fail("notFound", 404) };
  if (isLicenseBlocking(getEffectiveLicenseState(boutique))) {
    return { response: fail("storefrontExpired", 403) };
  }
  return { boutique };
}

export type OpenBoutique = NonNullable<Awaited<ReturnType<typeof loadOpenBoutique>>["boutique"]>;

// The boutiques the app lists: every one that is not closed by its license.
export async function listOpenBoutiques() {
  const boutiques = await prisma.storeType.findMany({
    orderBy: { createdAt: "asc" },
    include: BOUTIQUE_INCLUDE,
  });
  return boutiques.filter(
    (boutique) => !isLicenseBlocking(getEffectiveLicenseState(boutique)),
  );
}
