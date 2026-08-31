import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { CheckoutFlow } from "@/components/checkout/checkout-flow";
import { getPublicBoutiqueSettings } from "@/lib/queries/settings";
import { resolveBoutiqueText } from "@/lib/shop/localized-boutique-text";
import { getStorefrontBasePath } from "@/lib/shop/storefront-path";
import { getWalletLogoUrl } from "@/lib/supabase/storage";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ storeType: string }>;
}): Promise<Metadata> {
  const { storeType } = await params;
  const [t, tShop, locale, boutique] = await Promise.all([
    getTranslations("checkout"),
    getTranslations("shop"),
    getLocale(),
    getPublicBoutiqueSettings(storeType),
  ]);
  const siteName = resolveBoutiqueText(boutique, locale).siteName?.trim() || tShop("siteName");

  // The cart this page renders lives only in the browser — nothing unique
  // for a crawler to index. Kept out of search the same way track-order is
  // (see its generateMetadata), instead of competing as thin content and
  // sitting on an inherited canonical that points at the boutique home.
  return {
    title: `${t("title")} — ${siteName}`,
    robots: { index: false, follow: true },
  };
}

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ storeType: string }>;
}) {
  const { storeType } = await params;
  const [boutique, basePath] = await Promise.all([
    getPublicBoutiqueSettings(storeType),
    getStorefrontBasePath(storeType),
  ]);

  return (
    <CheckoutFlow
      storeType={storeType}
      basePath={basePath}
      settings={{
        wallets: boutique.walletAccounts.map((wallet) => ({
          provider: wallet.provider,
          number: wallet.number,
          logoUrl: wallet.logoStoragePath ? getWalletLogoUrl(wallet.logoStoragePath) : null,
        })),
        adminWhatsappNumber: boutique.adminWhatsappNumber,
        paymentInstructions: boutique.paymentInstructions,
      }}
    />
  );
}
