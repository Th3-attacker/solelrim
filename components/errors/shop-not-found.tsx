import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";

// Ex-app/[locale]/[storeType]/not-found.tsx.
export function ShopNotFound() {
  const t = useTranslations("errors");

  return (
    <StateMessage
      heading="h1"
      icon={MagnifyingGlass}
      title={t("notFoundTitle")}
      message={t("notFoundMessage")}
      action={
        <Button asChild size="lg">
          <Link href="/">{t("backToShop")}</Link>
        </Button>
      }
    />
  );
}
