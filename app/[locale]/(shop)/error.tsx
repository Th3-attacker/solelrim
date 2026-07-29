"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";

export default function ShopError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
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
        <Button size="lg" onClick={() => unstable_retry()}>
          {t("retry")}
        </Button>
      }
    />
  );
}
