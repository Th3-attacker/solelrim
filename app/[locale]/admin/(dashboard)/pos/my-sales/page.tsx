import { ArrowLeft, MagnifyingGlass, Receipt } from "@phosphor-icons/react/dist/ssr";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireCheckoutViewScope } from "@/lib/shop/admin-scope";
import { getMySales, MY_SALES_PAGE_SIZE } from "@/lib/queries/my-sales";
import { parseMySalesFilters } from "@/lib/shop/my-sales-filters";
import { formatPrice } from "@/lib/format/currency";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListPagination } from "@/components/ui/list-pagination";
import { StateMessage } from "@/components/ui/state-message";
import { MySalesFilters } from "@/components/pos/my-sales-filters";

// Read-only list of the caller's own sales (seller, or an admin who sells).
// getMySales always scopes to the session's seller and boutique.
export default async function MySalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseMySalesFilters(params);
  const page = Number(typeof params.page === "string" ? params.page : "") || 1;
  const { admin, productType } = await requireCheckoutViewScope();

  const [{ sales, total, summary, walletProviders }, t, tCommon, format] = await Promise.all([
    getMySales(productType, admin.id, filters, page),
    getTranslations("mySales"),
    getTranslations("common"),
    getFormatter(),
  ]);
  const money = (amount: number) => formatPrice(amount, tCommon("currency"));
  const hasFilters = Boolean(
    filters.from || filters.to || filters.status || filters.payment || filters.reference,
  );

  function paymentLabel(method: string | null, provider: string | null) {
    if (method === "cash") return t("cash");
    if (method === "wallet") return provider ?? t("wallet");
    return "—";
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <Button asChild variant="ghost">
          <Link href="/admin/pos">
            <ArrowLeft className="size-4 rtl:rotate-180" />
            {t("backToCheckout")}
          </Link>
        </Button>
      </div>

      <MySalesFilters walletProviders={walletProviders} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Tile label={t("salesCount")} value={String(summary.salesCount)} />
        <Tile label={t("soldTotal")} value={money(summary.soldTotal)} strong />
        {summary.breakdown.map((row) => (
          <Tile
            key={`${row.method}:${row.provider ?? ""}`}
            label={
              row.method === "cash"
                ? t("collectedCash")
                : row.method === "wallet"
                  ? t("collectedWallet", { wallet: row.provider ?? t("wallet") })
                  : t("collectedOther")
            }
            value={money(row.total)}
          />
        ))}
      </div>

      {sales.length === 0 ? (
        <StateMessage
          icon={hasFilters ? MagnifyingGlass : Receipt}
          title={hasFilters ? tCommon("noResults") : t("noSales")}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {sales.map((sale) => (
            <li key={sale.id} className="flex flex-col gap-2 rounded-md border p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/pos/receipt/${sale.id}`}
                    className="font-medium hover:underline"
                  >
                    {sale.reference}
                  </Link>
                  <Badge variant={sale.status === "COMPLETED" ? "secondary" : "destructive"}>
                    {t(sale.status === "COMPLETED" ? "statusCompleted" : "statusCancelled")}
                  </Badge>
                </div>
                <span className="text-sm text-muted-foreground">
                  {format.dateTime(sale.createdAt, { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </div>
              <ul className="flex flex-col text-sm">
                {sale.items.map((item, index) => (
                  <li key={index} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">
                      {item.name}{" "}
                      <span className="text-muted-foreground">
                        · {item.size} · {item.color}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums">× {item.quantity}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-sm">
                <span className="text-muted-foreground">
                  {paymentLabel(sale.paymentMethod, sale.walletProvider)}
                  {sale.clientName && ` · ${sale.clientName}`}
                </span>
                <span
                  className={
                    sale.status === "CANCELLED"
                      ? "font-semibold tabular-nums text-muted-foreground line-through"
                      : "font-semibold tabular-nums"
                  }
                >
                  {money(sale.total)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ListPagination
        page={page}
        pageSize={MY_SALES_PAGE_SIZE}
        total={total}
        basePath="/admin/pos/my-sales"
        searchParams={{
          from: typeof params.from === "string" ? params.from : undefined,
          to: typeof params.to === "string" ? params.to : undefined,
          status: typeof params.status === "string" ? params.status : undefined,
          payment: typeof params.payment === "string" ? params.payment : undefined,
          q: typeof params.q === "string" ? params.q : undefined,
        }}
      />
    </div>
  );
}

function Tile({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        dir="ltr"
        className={
          strong
            ? "text-start text-lg font-semibold tabular-nums rtl:text-end"
            : "text-start text-lg tabular-nums rtl:text-end"
        }
      >
        {value}
      </span>
    </div>
  );
}
