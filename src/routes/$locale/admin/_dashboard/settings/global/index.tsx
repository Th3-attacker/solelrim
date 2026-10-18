import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useTranslations } from "next-intl";
import { adminPageBoundaries } from "@/components/errors/admin-boundaries";
import { SettingsSkeleton } from "@/components/dashboard/page-skeletons";
import { getSolalContact, getStoreSettings, getStoreTypes } from "@/lib/queries/settings";
import { ProductTypePicker } from "@/components/settings/product-type-picker";
import { AdminUsersManager } from "@/components/settings/admin-users-manager";
import { BoutiquesOverview } from "@/components/settings/boutiques-overview";
import { BoutiqueLicenseManager } from "@/components/settings/boutique-license-manager";
import { SolalContactForm } from "@/components/settings/solal-contact-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSuperAdminPage } from "@/lib/auth/admin";
import { listBoutiqueAdmins } from "@/lib/queries/admin-users";

// Ex-app/[locale]/admin/(dashboard)/settings/global/page.tsx.

const loadGlobalSettingsPage = createServerFn({ method: "GET" }).handler(async () => {
  await requireSuperAdminPage();

  const [settings, storeTypes, boutiqueAdmins, solalContact] = await Promise.all([
    getStoreSettings(),
    getStoreTypes(),
    listBoutiqueAdmins(),
    getSolalContact(),
  ]);

  const boutiqueRows = storeTypes.map((type) => ({
    key: type.key,
    label: type.label,
    domain: type.domain,
    licenseType: type.licenseType,
    licenseStatus: type.licenseStatus,
    licenseExpiresAt: type.licenseExpiresAt,
    licenseClientName: type.licenseClientName,
    couponsEnabled: type.couponsEnabled,
    pendingAutoCancelHours: type.pendingAutoCancelHours,
  }));

  return { settings, storeTypes, boutiqueAdmins, solalContact, boutiqueRows };
});

export const Route = createFileRoute("/$locale/admin/_dashboard/settings/global/")({
  loader: () => loadGlobalSettingsPage(),
  component: GlobalSettingsPage,
  ...adminPageBoundaries,
  pendingComponent: SettingsSkeleton,
});

function GlobalSettingsPage() {
  const { settings, storeTypes, boutiqueAdmins, solalContact, boutiqueRows } =
    Route.useLoaderData();
  const t = useTranslations("settings");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("globalSettingsTitle")}</h1>

      <BoutiquesOverview storeTypes={storeTypes} />

      <ProductTypePicker storeTypes={storeTypes} currentProductType={settings.productType} />

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

      <SolalContactForm
        contact={{
          address: solalContact.address ?? "",
          phone: solalContact.phone ?? "",
          email: solalContact.email ?? "",
          website: solalContact.website ?? "",
        }}
      />
    </div>
  );
}
