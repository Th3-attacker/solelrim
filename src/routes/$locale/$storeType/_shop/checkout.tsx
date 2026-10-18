import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getTranslations } from "next-intl/server";
import { CheckoutFlow } from "@/components/checkout/checkout-flow";
import { shopPageBoundaries } from "@/components/errors/shop-boundaries";
import { resolveMetadata } from "@/lib/seo/head";
import { walletLogoSrc } from "@/lib/shop/wallet-providers";
import { getWalletLogoUrl } from "@/lib/supabase/storage";
import { getShopPageContext } from "@/src/server/shop";
import { stringFields } from "@/src/server/validators";

// Ex-app/[locale]/[storeType]/(shop)/checkout/page.tsx.

const loadCheckout = createServerFn({ method: "GET" })
  .validator(stringFields("storeType"))
  .handler(async ({ data: { storeType } }) => {
    const { boutique, basePath, siteName } = await getShopPageContext(storeType);
    const t = await getTranslations("checkout");

    return {
      // The cart this page renders lives only in the browser — nothing unique
      // for a crawler to index. Kept out of search the same way track-order is,
      // instead of competing as thin content and sitting on an inherited
      // canonical that points at the boutique home.
      meta: resolveMetadata({
        title: `${t("title")} — ${siteName}`,
        robots: { index: false, follow: true },
      }),
      basePath,
      settings: {
        wallets: boutique.walletAccounts.map((wallet) => ({
          provider: wallet.provider,
          number: wallet.number,
          logoUrl: walletLogoSrc(
            wallet.provider,
            wallet.logoStoragePath ? getWalletLogoUrl(wallet.logoStoragePath) : null,
          ),
        })),
        adminWhatsappNumber: boutique.adminWhatsappNumber,
        paymentInstructions: boutique.paymentInstructions,
        couponsEnabled: boutique.couponsEnabled,
      },
    };
  });

export const Route = createFileRoute("/$locale/$storeType/_shop/checkout")({
  loader: ({ params }) => loadCheckout({ data: { storeType: params.storeType } }),
  component: CheckoutPage,
  ...shopPageBoundaries,
});

function CheckoutPage() {
  const { storeType } = Route.useParams();
  const { basePath, settings } = Route.useLoaderData();
  return <CheckoutFlow storeType={storeType} basePath={basePath} settings={settings} />;
}
