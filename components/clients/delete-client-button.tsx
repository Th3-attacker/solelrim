"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ConfirmDeleteButton } from "@/components/ui/confirm-delete-button";
import { deleteClient } from "@/lib/actions/clients";

export function DeleteClientButton({ clientId }: { clientId: string }) {
  const t = useTranslations("clients");
  const tCommon = useTranslations("common");
  const router = useRouter();

  return (
    <ConfirmDeleteButton
      title={tCommon("confirm")}
      description={t("hasSalesError")}
      onDelete={() => deleteClient(clientId)}
      errorMessage={() => t("hasSalesError")}
      onDeleted={() => {
        router.push("/admin/clients");
        router.refresh();
      }}
    />
  );
}
