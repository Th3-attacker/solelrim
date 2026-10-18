import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useTranslations } from "next-intl";
import { adminPageBoundaries } from "@/components/errors/admin-boundaries";
import { pageInput } from "@/src/server/validators";
import { ArrowCounterClockwise } from "@phosphor-icons/react/dist/ssr";
import { Link } from "@/i18n/navigation";
import { requireCheckoutViewScope } from "@/lib/auth/scope";
import { countPendingRefunds, listRefundRequests, REFUNDS_PAGE_SIZE } from "@/lib/queries/refunds";
import { toPageNumber } from "@/lib/shop/pagination";
import { cn } from "@/lib/utils";
import { ListPagination } from "@/components/ui/list-pagination";
import { StateMessage } from "@/components/ui/state-message";
import { RefundRequestList } from "@/components/refunds/refund-request-list";
import { SectionTabs } from "@/components/dashboard/section-tabs";
import { getTranslations } from "next-intl/server";

// Ex-app/[locale]/admin/(dashboard)/pos/refunds/page.tsx.

const STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
type Status = (typeof STATUSES)[number];

// A seller follows their own requests; an admin sees (and decides) every
// request of the boutique — pending ones by default.

const loadRefundsPage = createServerFn({ method: "GET" })
  .validator(pageInput)
  .handler(async ({ data }) => {
    const params = data.search;
    const { admin, productType } = await requireCheckoutViewScope();
    const isAdmin = admin.role !== "SELLER";
    const pendingRefunds = isAdmin ? await countPendingRefunds(productType) : 0;
    const status: Status | null =
      params.status === "all"
        ? null
        : (STATUSES as readonly string[]).includes(params.status ?? "")
          ? (params.status as Status)
          : isAdmin
            ? "PENDING"
            : null;
    const page = toPageNumber(Number(params.page));

    const [{ requests, total }, t] = await Promise.all([
      listRefundRequests(productType, admin, status, page),
      getTranslations("refunds"),
    ]);

    const tabs: { key: string; label: string; active: boolean }[] = [
      ...STATUSES.map((value) => ({
        key: value,
        label: t(`status.${value}`),
        active: status === value,
      })),
      { key: "all", label: t("all"), active: status === null },
    ];

    // Les tailles de page viennent du serveur : leurs modules (lib/queries)
    // importent Prisma et n'ont rien à faire dans le navigateur.
    return {
      params,
      isAdmin,
      pendingRefunds,
      page,
      requests,
      total,
      tabs,
      refundsPageSize: REFUNDS_PAGE_SIZE,
    };
  });

export const Route = createFileRoute("/$locale/admin/_dashboard/pos/refunds")({
  loaderDeps: ({ search }) => ({ search }),
  loader: ({ deps }) => loadRefundsPage({ data: { search: deps.search } }),
  component: RefundsPage,
  ...adminPageBoundaries,
});

function RefundsPage() {
  const { params, isAdmin, pendingRefunds, page, requests, total, tabs, refundsPageSize } =
    Route.useLoaderData();
  const t = useTranslations("refunds");

  return (
    <div className="flex flex-col gap-6">
      {isAdmin && (
        <SectionTabs group="sales" current="/admin/pos/refunds" pendingRefunds={pendingRefunds} />
      )}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin ? t("adminHint") : t("sellerHint")}
        </p>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label={t("filterLabel")}>
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={`/admin/pos/refunds?status=${tab.key}`}
            aria-current={tab.active ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              tab.active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {requests.length === 0 ? (
        <StateMessage icon={ArrowCounterClockwise} title={t("empty")} />
      ) : (
        <RefundRequestList requests={requests} canDecide={isAdmin} />
      )}

      <ListPagination
        page={page}
        pageSize={refundsPageSize}
        total={total}
        basePath="/admin/pos/refunds"
        searchParams={{ status: params.status }}
      />
    </div>
  );
}
