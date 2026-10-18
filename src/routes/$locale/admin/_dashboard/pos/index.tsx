import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useFormatter, useTranslations } from "next-intl";
import { adminPageBoundaries } from "@/components/errors/admin-boundaries";
import { CashRegister } from "@phosphor-icons/react/dist/ssr";
import { Link } from "@/i18n/navigation";
import { requireCheckoutScope } from "@/lib/auth/scope";
import { getPosCatalog, getPosLoyaltyRule, getPosWallets } from "@/lib/queries/pos";
import { getOpenSession } from "@/lib/queries/cash-sessions";
import { Button } from "@/components/ui/button";
import { CheckoutScreen } from "@/components/pos/checkout-screen";
import { OpenRegisterForm } from "@/components/cash/open-register-form";

// Ex-app/[locale]/admin/(dashboard)/pos/page.tsx.

// The checkout (reachable by a SELLER, see proxy.ts). requireCheckoutScope
// resolves the caller's own boutique and refuses a suspended/expired one,
// same as the sale action it feeds. No till open, no checkout: the caller
// opens theirs first (recordSale refuses a sale without one anyway).

const loadPosPage = createServerFn({ method: "GET" }).handler(async () => {
  const { admin, productType } = await requireCheckoutScope();
  const session = await getOpenSession(admin.id, productType);
  // Pas de caisse ouverte : la page affiche le formulaire d'ouverture.
  if (!session) {
    return { session: null } as const;
  }

  const [products, wallets, loyaltyRule] = await Promise.all([
    getPosCatalog(productType),
    getPosWallets(productType),
    getPosLoyaltyRule(productType),
  ]);

  return { session, products, wallets, loyaltyRule };
});

export const Route = createFileRoute("/$locale/admin/_dashboard/pos/")({
  loader: () => loadPosPage(),
  component: PosPage,
  ...adminPageBoundaries,
});

function PosPage() {
  const page = Route.useLoaderData();
  const t = useTranslations("cash");
  const format = useFormatter();

  if (!page.session) {
    return <OpenRegisterForm />;
  }
  const { session, products, wallets, loyaltyRule } = page;

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
