import { CashRegister } from "@phosphor-icons/react/dist/ssr";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireCheckoutScope } from "@/lib/shop/admin-scope";
import { getPosCatalog, getPosLoyaltyRule, getPosWallets } from "@/lib/queries/pos";
import { getOpenSession } from "@/lib/queries/cash-sessions";
import { Button } from "@/components/ui/button";
import { CheckoutScreen } from "@/components/pos/checkout-screen";
import { OpenRegisterForm } from "@/components/cash/open-register-form";

// The checkout (reachable by a SELLER, see proxy.ts). requireCheckoutScope
// resolves the caller's own boutique and refuses a suspended/expired one,
// same as the sale action it feeds. No till open, no checkout: the caller
// opens theirs first (recordSale refuses a sale without one anyway).
export default async function PosPage() {
  const { admin, productType } = await requireCheckoutScope();
  const session = await getOpenSession(admin.id, productType);
  if (!session) {
    return <OpenRegisterForm />;
  }

  const [products, wallets, loyaltyRule, t, format] = await Promise.all([
    getPosCatalog(productType),
    getPosWallets(productType),
    getPosLoyaltyRule(productType),
    getTranslations("cash"),
    getFormatter(),
  ]);

  return (
    <CheckoutScreen
      products={products}
      wallets={wallets}
      loyaltyRule={loyaltyRule}
      sessionBar={
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/pos/register">
            <CashRegister className="size-4" />
            {t("openSince", { time: format.dateTime(session.openedAt, { timeStyle: "short" }) })}
          </Link>
        </Button>
      }
    />
  );
}
