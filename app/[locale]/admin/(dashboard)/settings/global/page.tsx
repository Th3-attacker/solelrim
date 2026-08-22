import { getTranslations } from "next-intl/server";
import { getStoreSettings, getStoreTypes } from "@/lib/queries/settings";
import { ProductTypePicker } from "@/components/settings/product-type-picker";
import { AdminUsersManager } from "@/components/settings/admin-users-manager";
import { BoutiqueLicenseManager } from "@/components/settings/boutique-license-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSuperAdminPage } from "@/lib/auth/admin";
import { listBoutiqueAdmins } from "@/lib/queries/admin-users";

export default async function GlobalSettingsPage() {
  await requireSuperAdminPage();

  const [t, settings, storeTypes, boutiqueAdmins] = await Promise.all([
    getTranslations("settings"),
    getStoreSettings(),
    getStoreTypes(),
    listBoutiqueAdmins(),
  ]);

  const boutiqueRows = storeTypes.map((type) => ({
    key: type.key,
    label: type.label,
    domain: type.domain,
    licenseExpiresAt: type.licenseExpiresAt,
  }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("globalSettingsTitle")}</h1>

      <ProductTypePicker
        storeTypes={storeTypes}
        currentProductType={settings.productType}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("boutiquesSection")}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <BoutiqueLicenseManager storeTypes={boutiqueRows} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("adminUsersSection")}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <AdminUsersManager admins={boutiqueAdmins} storeTypes={boutiqueRows} />
        </CardContent>
      </Card>
    </div>
  );
}
