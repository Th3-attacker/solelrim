import { createFileRoute } from "@tanstack/react-router";
import { useTranslations } from "next-intl";
import { adminPageBoundaries } from "@/components/errors/admin-boundaries";
import { ClientsSkeleton } from "@/components/dashboard/page-skeletons";
import { ClientForm } from "@/components/clients/client-form";

// Ex-app/[locale]/admin/(dashboard)/clients/new/page.tsx.

export const Route = createFileRoute("/$locale/admin/_dashboard/clients/new")({
  component: NewClientPage,
  ...adminPageBoundaries,
  pendingComponent: ClientsSkeleton,
});

function NewClientPage() {
  const t = useTranslations("clients");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("newClient")}</h1>
      <ClientForm />
    </div>
  );
}
