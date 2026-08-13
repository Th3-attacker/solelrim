"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
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

  return (
    <StateMessage
      icon={TriangleAlert}
      title={t("errorTitle")}
      message={t("errorMessage")}
      action={
        <Button size="lg" onClick={() => retry()}>
          {t("retry")}
        </Button>
      }
    />
  );
}
