import { createFileRoute } from "@tanstack/react-router";
import { useTranslations } from "use-intl";
import { PageHeader } from "~/components/ui/page-header";

// The design's dashboard (step 2) takes this page over.
export const Route = createFileRoute("/$locale/admin/_dashboard/")({
  staticData: { title: "nav.dashboard" },
  component: DashboardPage,
});

function DashboardPage() {
  const t = useTranslations("nav");
  const { admin } = Route.useRouteContext();

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-4 pt-7 pb-14 md:px-8">
      <PageHeader title={t("dashboard")} description={admin.email} />
    </div>
  );
}
