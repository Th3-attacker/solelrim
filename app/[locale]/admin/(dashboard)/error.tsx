"use client";

import { useEffect } from "react";
import { Warning } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";

export default function DashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error(error);
  }, [error]);

  // Thrown by requireWritableAdminScope/requireAppearanceScope
  // (lib/shop/admin-scope.ts) when a BOUTIQUE_ADMIN's boutique is
  // suspended/expired/cancelled — worth a distinct message instead of the
  // generic "something went wrong", since it isn't a bug and retrying won't
  // help until the license is reactivated.
  const isLicenseBlocked = error.message === "licenseBlocked";

  return (
    <StateMessage
      icon={Warning}
      title={isLicenseBlocked ? t("licenseBlockedTitle") : t("errorTitle")}
      message={isLicenseBlocked ? t("licenseBlockedMessage") : t("errorMessage")}
      action={
        <Button size="lg" onClick={() => retry()}>
          {t("retry")}
        </Button>
      }
    />
  );
}
