import { getTranslations } from "next-intl/server";
import { Plus, Package } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getAllProducts } from "@/lib/queries/products";
import { getAggregateStockStatus } from "@/lib/shop/stock";
import { getAdminScope } from "@/lib/shop/admin-scope";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StateMessage } from "@/components/ui/state-message";
import { StockBadge } from "@/components/shop/stock-badge";
import { DeleteProductButton } from "@/components/products/delete-product-button";
import { formatPrice } from "@/lib/format/currency";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminProductsPage() {
  const scope = await getAdminScope();
  const [t, tCommon, products] = await Promise.all([
    getTranslations("products"),
    getTranslations("common"),
    getAllProducts(scope),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <Button asChild>
          <Link href="/admin/products/new">
            <Plus className="size-4" />
            {t("newProduct")}
          </Link>
        </Button>
      </div>

      {products.length === 0 ? (
        <StateMessage icon={Package} title={t("noProducts")} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("category")}</TableHead>
              <TableHead>{t("basePrice")}</TableHead>
              <TableHead>{t("stock")}</TableHead>
              <TableHead></TableHead>
              <TableHead className="text-end">{tCommon("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  <Link
                    href={`/admin/products/${product.id}/edit`}
                    className="font-medium hover:underline"
                  >
                    {product.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {product.category.name}
                </TableCell>
                <TableCell>{formatPrice(product.basePrice, tCommon("currency"))}</TableCell>
                <TableCell>
                  <StockBadge status={getAggregateStockStatus(product.variants)} />
                </TableCell>
                <TableCell>
                  {!product.isActive && (
                    <Badge variant="secondary">{t("inactive")}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-end">
                  <DeleteProductButton productId={product.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
