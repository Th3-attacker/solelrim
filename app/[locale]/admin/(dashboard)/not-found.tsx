import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";

export default async function DashboardNotFound() {
  const t = await getTranslations("errors");

  return (
    <StateMessage
      icon={MagnifyingGlass}
      title={t("notFoundTitle")}
      message={t("notFoundMessage")}
      action={
        <Button asChild size="lg">
          <Link href="/admin">{t("backToDashboard")}</Link>
        </Button>
      }
    />
  );
}
