import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPage } from "@/lib/auth/admin";
import { getSolalContact } from "@/lib/queries/settings";
import { LicenseContractDocument } from "@/components/settings/license-contract-document";
import { PrintInvoiceButton } from "@/components/sales/print-invoice-button";

// Superadmin-only, reached from the "Contrat" button on each boutique's row
// in Réglages globaux (components/settings/boutique-license-manager.tsx) —
// not a BOUTIQUE_ADMIN-facing page, since it exposes the Client's legal
// name and the full commercial terms.
export default async function LicenseContractPage({
  params,
}: {
  params: Promise<{ productType: string }>;
}) {
  await requireSuperAdminPage();
  const { productType } = await params;

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

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 print:max-w-full">
      <div className="print:hidden">
        <PrintInvoiceButton />
      </div>
      <div className="rounded-lg border p-8 print:border-0 print:p-0">
        <LicenseContractDocument boutique={boutique} solalContact={solalContact} />
      </div>
    </div>
  );
}
