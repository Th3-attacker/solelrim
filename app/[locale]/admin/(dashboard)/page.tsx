import { getTranslations } from "next-intl/server";
import {
  getRevenueByDay,
  getBestSellers,
  getLowStockVariants,
  getSummaryStats,
} from "@/lib/queries/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function DashboardPage() {
  const [t, tProducts, revenue, bestSellers, lowStock, summary] =
    await Promise.all([
      getTranslations("dashboard"),
      getTranslations("products"),
      getRevenueByDay(),
      getBestSellers(),
      getLowStockVariants(),
      getSummaryStats(),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground">
              {t("revenueThisMonth")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {summary.revenueThisMonth.toFixed(2)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground">
              {t("salesThisMonth")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {summary.salesThisMonth}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground">
              {t("activeClients")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {summary.activeClients}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground">
              {t("unitsInStock")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {summary.unitsInStock}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("revenueOverTime")}</CardTitle>
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
