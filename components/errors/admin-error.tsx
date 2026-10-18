import { Warning } from "@phosphor-icons/react/dist/ssr";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { useReportedError } from "@/hooks/use-reported-error";
import { Link } from "@/i18n/navigation";
import { expectedErrorCode } from "@/lib/errors";

// Ex-app/[locale]/admin/(dashboard)/error.tsx : la page en erreur, affichée
// dans le cadre du tableau de bord (src/routes/$locale/admin/_dashboard).
export function AdminError({ error, reset }: ErrorComponentProps) {
  const t = useTranslations("errors");
  const reference = useReportedError(error as Error);

  // Refusals thrown on purpose (lib/errors.ts) get their own words: none is
  // a bug, and retrying won't help. licenseBlocked comes from
  // requireWritableAdminScope/requireAppearanceScope when a BOUTIQUE_ADMIN's
  // boutique is suspended, expired or cancelled.
  switch (expectedErrorCode(error)) {
    case "licenseBlocked":
      return (
        <StateMessage
          heading="h1"
          icon={Warning}
          title={t("licenseBlockedTitle")}
          message={t("licenseBlockedMessage")}
        />
      );
    case "unauthorized":
      return (
        <StateMessage
          heading="h1"
          icon={Warning}
          title={t("sessionExpiredTitle")}
          message={t("sessionExpiredMessage")}
          action={
            <Button size="lg" asChild>
              <Link href="/admin/login">{t("signIn")}</Link>
            </Button>
          }
        />
      );
    case "forbidden":
      return (
        <StateMessage
          heading="h1"
          icon={Warning}
          title={t("forbiddenTitle")}
          message={t("forbiddenMessage")}
        />
      );
  }

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
