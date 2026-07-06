import { getTranslations } from "next-intl/server";
import { ClientForm } from "@/components/clients/client-form";

export default async function NewClientPage() {
  const t = await getTranslations("clients");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("newClient")}</h1>
      <ClientForm />
    </div>
  );
}
