import { requireCheckoutScope } from "@/lib/shop/admin-scope";
import { getPosCatalog, getPosWallets } from "@/lib/queries/pos";
import { CheckoutScreen } from "@/components/pos/checkout-screen";

// The one admin page a SELLER can open (proxy.ts). requireCheckoutScope
// resolves the caller's own boutique and refuses a suspended/expired one,
// same as the sale action it feeds.
export default async function PosPage() {
  const { productType } = await requireCheckoutScope();
  const [products, wallets] = await Promise.all([
    getPosCatalog(productType),
    getPosWallets(productType),
  ]);

  return <CheckoutScreen products={products} wallets={wallets} />;
}
