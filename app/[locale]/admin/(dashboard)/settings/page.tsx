import { getTranslations } from "next-intl/server";
import { getStoreSettings } from "@/lib/queries/settings";
import { SettingsForm } from "@/components/settings/settings-form";

export default async function SettingsPage() {
  const [t, settings] = await Promise.all([
    getTranslations("settings"),
    getStoreSettings(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <SettingsForm
        defaultValues={{
          bankilyNumber: settings.bankilyNumber ?? "",
          masrivyNumber: settings.masrivyNumber ?? "",
          adminWhatsappNumber: settings.adminWhatsappNumber ?? "",
          paymentInstructions: settings.paymentInstructions ?? "",
        }}
      />
    </div>
  );
}
