import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CheckoutFlow } from "@/components/checkout/checkout-flow";
import { getPublicBoutiqueSettings } from "@/lib/queries/settings";
import { getStorefrontBasePath } from "@/lib/shop/storefront-path";
import { getWalletLogoUrl } from "@/lib/supabase/storage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("checkout");
  return { title: t("title") };
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
