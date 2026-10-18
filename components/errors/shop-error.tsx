import { Warning } from "@phosphor-icons/react/dist/ssr";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { useReportedError } from "@/hooks/use-reported-error";

// Ex-app/[locale]/[storeType]/(shop)/error.tsx : la page en erreur, affichée
// dans le cadre de la boutique (en-tête, pied de page).
export function ShopError({ error, reset }: ErrorComponentProps) {
  const t = useTranslations("errors");
  const reference = useReportedError(error as Error);

  return (
    <StateMessage
      heading="h1"
      icon={Warning}
      title={t("errorTitle")}
      message={t("errorMessage")}
      detail={reference && t("reference", { code: reference })}
      action={
        <Button size="lg" onClick={() => reset()}>
          {t("retry")}
        </Button>
      }
    />
  );
}
