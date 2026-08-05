import { TrendingDown, TrendingUp, AlertTriangle, UserPlus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import {
  getRevenueByDay,
  getBestSellers,
  getLowStockVariants,
  getSummaryStats,
} from "@/lib/queries/dashboard";
import { getAdminScope } from "@/lib/shop/admin-scope";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { formatPrice } from "@/lib/format/currency";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export default async function DashboardPage() {
  const scope = await getAdminScope();
  const [t, tProducts, tCommon, revenue, bestSellers, lowStock, summary] =
    await Promise.all([
      getTranslations("dashboard"),
      getTranslations("products"),
      getTranslations("common"),
      getRevenueByDay(scope),
      getBestSellers(scope),
      getLowStockVariants(scope),
      getSummaryStats(scope),
    ]);

  const revenueTrend = percentChange(summary.revenueThisMonth, summary.revenueLastMonth);
  const salesTrend = percentChange(summary.salesThisMonth, summary.salesLastMonth);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label={t("revenueThisMonth")}
          value={formatPrice(summary.revenueThisMonth, tCommon("currency"))}
          badge={
            revenueTrend !== null && (
              <Badge variant="outline" className="gap-1">
                {revenueTrend >= 0 ? (
                  <TrendingUp className="size-3" />
                ) : (
                  <TrendingDown className="size-3" />
                )}
                {revenueTrend >= 0 ? "+" : ""}
                {revenueTrend.toFixed(1)}%
              </Badge>
            )
          }
          description={
            <>
              {revenueTrend !== null && revenueTrend >= 0
                ? t("trendUp")
                : t("trendDown")}
              {revenueTrend !== null &&
                (revenueTrend >= 0 ? (
                  <TrendingUp className="size-4" />
                ) : (
                  <TrendingDown className="size-4" />
                ))}
            </>
          }
          subtitle={t("vsLastMonth")}
        />

        <StatCard
          label={t("salesThisMonth")}
          value={summary.salesThisMonth}
          badge={
            salesTrend !== null && (
              <Badge variant="outline" className="gap-1">
                {salesTrend >= 0 ? (
                  <TrendingUp className="size-3" />
                ) : (
                  <TrendingDown className="size-3" />
                )}
                {salesTrend >= 0 ? "+" : ""}
                {salesTrend.toFixed(1)}%
              </Badge>
            )
          }
          description={
            <>
              {salesTrend !== null && salesTrend >= 0 ? t("trendUp") : t("trendDown")}
              {salesTrend !== null &&
                (salesTrend >= 0 ? (
                  <TrendingUp className="size-4" />
                ) : (
                  <TrendingDown className="size-4" />
                ))}
            </>
          }
          subtitle={t("vsLastMonth")}
        />

        <StatCard
          label={t("revenueAllTime")}
          value={formatPrice(summary.revenueAllTime, tCommon("currency"))}
          description={t("salesAllTimeCount", { count: summary.salesAllTime })}
          subtitle={t("sinceBeginning")}
        />

        <StatCard
          label={t("activeClients")}
          value={summary.activeClients}
          badge={
            summary.newClientsThisMonth > 0 && (
              <Badge variant="outline" className="gap-1">
                <UserPlus className="size-3" />+{summary.newClientsThisMonth}
              </Badge>
            )
          }
          description={t("newClientsThisMonth", { count: summary.newClientsThisMonth })}
          subtitle={t("totalClientsSubtitle")}
        />

        <StatCard
          label={t("unitsInStock")}
          value={summary.unitsInStock}
          badge={
            lowStock.length > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="size-3" />
                {lowStock.length}
              </Badge>
            )
          }
          description={
            lowStock.length > 0
              ? t("lowStockCount", { count: lowStock.length })
              : t("stockHealthy")
          }
          subtitle={t("totalStockSubtitle")}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("revenueOverTime")}</CardTitle>
          <CardDescription>{t("revenueOverTimeSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <RevenueChart data={revenue} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("bestSellers")}</CardTitle>
          </CardHeader>
          <CardContent>
            {bestSellers.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noBestSellers")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tProducts("name")}</TableHead>
                    <TableHead>{t("quantitySold")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bestSellers.map((item) => (
                    <TableRow key={item.variantId}>
                      <TableCell>
                        {item.productName} ({item.size}/{item.color})
                      </TableCell>
                      <TableCell>{item.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("lowStock")}</CardTitle>
          </CardHeader>
          <CardContent>
            {lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noLowStock")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tProducts("name")}</TableHead>
                    <TableHead>{tProducts("stock")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStock.map((variant) => (
                    <TableRow key={variant.id}>
                      <TableCell>
                        {variant.productName} ({variant.size}/{variant.color})
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400"
                        >
                          {variant.stock}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
