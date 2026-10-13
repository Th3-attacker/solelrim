"use client";

import { Warning } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { useReportedError } from "@/hooks/use-reported-error";

export default function ShopError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations("errors");
  const reference = useReportedError(error);

  return (
    <StateMessage
      icon={Warning}
      title={t("errorTitle")}
      message={t("errorMessage")}
      detail={reference && t("reference", { code: reference })}
      action={
        <Button size="lg" onClick={() => retry()}>
          {t("retry")}
        </Button>
      }
    />
  );
}
