import { requireCheckoutScope } from "@/lib/shop/admin-scope";
import { getPosCatalog, getPosLoyaltyRule, getPosWallets } from "@/lib/queries/pos";
import { CheckoutScreen } from "@/components/pos/checkout-screen";

// The one admin page a SELLER can open (proxy.ts). requireCheckoutScope
// resolves the caller's own boutique and refuses a suspended/expired one,
// same as the sale action it feeds.
export default async function PosPage() {
  const { productType } = await requireCheckoutScope();
  const [products, wallets, loyaltyRule] = await Promise.all([
    getPosCatalog(productType),
    getPosWallets(productType),
    getPosLoyaltyRule(productType),
  ]);

  return <CheckoutScreen products={products} wallets={wallets} loyaltyRule={loyaltyRule} />;
}
