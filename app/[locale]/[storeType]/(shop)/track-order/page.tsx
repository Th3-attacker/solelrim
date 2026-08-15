import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { getPublicBoutiqueSettings } from "@/lib/queries/settings";
import { resolveBoutiqueText } from "@/lib/shop/localized-boutique-text";
import { TrackOrderForm } from "@/components/shop/track-order-form";

// A per-customer utility page (empty form, no unique copy) rather than a
// keyword-targeted one — indexing it across every boutique would just be
// near-identical thin content competing with the actual product/category
// pages for crawl budget, so it's excluded from search while staying
// perfectly reachable for anyone who already has the link.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ storeType: string }>;
}): Promise<Metadata> {
  const { storeType } = await params;
  const [t, tShop, locale, boutique] = await Promise.all([
    getTranslations("trackOrder"),
    getTranslations("shop"),
    getLocale(),
    getPublicBoutiqueSettings(storeType),
  ]);
  const siteName = resolveBoutiqueText(boutique, locale).siteName?.trim() || tShop("siteName");

  return {
    title: `${t("title")} — ${siteName}`,
    description: t("subtitle"),
    robots: { index: false, follow: true },
  };
}

export default function TrackOrderPage() {
  return <TrackOrderForm />;
}
