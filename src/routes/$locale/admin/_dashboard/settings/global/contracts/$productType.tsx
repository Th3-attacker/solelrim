import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { adminPageBoundaries } from "@/components/errors/admin-boundaries";
import { SettingsSkeleton } from "@/components/dashboard/page-skeletons";
import { pageInput } from "@/src/server/validators";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPage } from "@/lib/auth/admin";
import { getSolalContact } from "@/lib/queries/settings";
import { LicenseContractDocument } from "@/components/settings/license-contract-document";
import { PrintInvoiceButton } from "@/components/sales/print-invoice-button";

// Ex-app/[locale]/admin/(dashboard)/settings/global/contracts/[productType]/page.tsx.

// Superadmin-only, reached from the "Contrat" button on each boutique's row
// in Réglages globaux (components/settings/boutique-license-manager.tsx) —
// not a BOUTIQUE_ADMIN-facing page, since it exposes the Client's legal
// name and the full commercial terms.

const loadLicenseContractPage = createServerFn({ method: "GET" })
  .validator(pageInput)
  .handler(async ({ data }) => {
    await requireSuperAdminPage();
    const { productType } = data.params;

    const [boutique, solalContact] = await Promise.all([
      prisma.storeType.findUnique({
        where: { key: productType },
        select: {
          label: true,
          domain: true,
          licenseType: true,
          licenseStatus: true,
          licenseStartedAt: true,
          licenseExpiresAt: true,
          licenseClientName: true,
        },
      }),
      getSolalContact(),
    ]);
    if (!boutique) {
      notFound();
    }

    return { boutique, solalContact };
  });

export const Route = createFileRoute(
  "/$locale/admin/_dashboard/settings/global/contracts/$productType",
)({
  loader: ({ params }) => loadLicenseContractPage({ data: { params } }),
  component: LicenseContractPage,
  ...adminPageBoundaries,
  pendingComponent: SettingsSkeleton,
});

function LicenseContractPage() {
  const { boutique, solalContact } = Route.useLoaderData();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 print:max-w-full">
      <div className="print:hidden">
        <PrintInvoiceButton />
      </div>
      <div className="rounded-lg border bg-card p-8 print:border-0 print:p-0">
        <LicenseContractDocument boutique={boutique} solalContact={solalContact} />
      </div>
    </div>
  );
}
