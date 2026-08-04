import { cache } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

// Every visible storefront concern now lives on StoreType (one row per
// boutique, each with its own public route) — this singleton keeps a
// single job left: which boutique "/" redirects to.
export const getStoreSettings = cache(function getStoreSettings() {
  return prisma.storeSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
});

// Every boutique that has ever been created — the durable registry behind
// the public [storeType] route segment, the admin scope switcher, and the
// product-type picker.
export const getStoreTypes = cache(function getStoreTypes() {
  return prisma.storeType.findMany({ orderBy: { createdAt: "asc" } });
});

// A single boutique's full public/admin-facing settings, by its productType
// key — for the admin settings page, whose productType always comes from
// requireAdminScope() and is therefore guaranteed to already be a real
// boutique (throwing here would mean that guarantee broke, not bad input).
export const getBoutiqueSettings = cache(function getBoutiqueSettings(
  productType: string,
) {
  return prisma.storeType.findUniqueOrThrow({
    where: { key: productType },
    include: {
      socialLinks: { orderBy: { position: "asc" } },
      walletAccounts: { orderBy: { position: "asc" } },
    },
  });
});

// Same data, for public storefront pages — productType there comes straight
// from the URL's [storeType] segment, so it isn't trustworthy input, and 404s
// instead of throwing when it doesn't match a real boutique. Every one of
// these pages/layouts is nested under [storeType]/layout.tsx, which already
// runs this same check — but Next resolves metadata and nested segments in
// parallel with an ancestor layout's own body, so a page can't rely on that
// check having already run by the time its own code executes.
export const getPublicBoutiqueSettings = cache(async function getPublicBoutiqueSettings(
  productType: string,
) {
  const boutique = await prisma.storeType.findUnique({
    where: { key: productType },
    include: {
      socialLinks: { orderBy: { position: "asc" } },
      walletAccounts: { orderBy: { position: "asc" } },
    },
  });
  if (!boutique) {
    notFound();
  }
  return boutique;
});
