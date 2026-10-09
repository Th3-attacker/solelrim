import { ArrowCounterClockwise } from "@phosphor-icons/react/dist/ssr";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireCheckoutViewScope } from "@/lib/shop/admin-scope";
import { countPendingRefunds, listRefundRequests, REFUNDS_PAGE_SIZE } from "@/lib/queries/refunds";
import { toPageNumber } from "@/lib/shop/pagination";
import { cn } from "@/lib/utils";
import { ListPagination } from "@/components/ui/list-pagination";
import { StateMessage } from "@/components/ui/state-message";
import { RefundRequestList } from "@/components/refunds/refund-request-list";
import { SectionTabs } from "@/components/dashboard/section-tabs";

const STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
type Status = (typeof STATUSES)[number];

// A seller follows their own requests; an admin sees (and decides) every
// request of the boutique — pending ones by default.
export default async function RefundsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
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
    ...STATUSES.map((value) => ({ key: value, label: t(`status.${value}`), active: status === value })),
    { key: "all", label: t("all"), active: status === null },
  ];

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
        pageSize={REFUNDS_PAGE_SIZE}
        total={total}
        basePath="/admin/pos/refunds"
        searchParams={{ status: params.status }}
      />
    </div>
  );
}
