"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { StockBadge } from "@/components/shop/stock-badge";
import { DeleteProductButton } from "@/components/products/delete-product-button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { getAggregateStockStatus } from "@/lib/shop/stock";
import { formatPrice } from "@/lib/format/currency";
import { bulkSetProductsActive, bulkDeleteProducts } from "@/lib/actions/products";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Plain shape, not the raw getAllProducts() return type — Prisma's Decimal
// fields (basePrice here) can't cross the server/client boundary as-is,
// same reason product-detail-view.tsx takes a pre-converted number instead
// of the Product model's own type.
type Product = {
  id: string;
  name: string;
  isActive: boolean;
  basePrice: number;
  category: { name: string };
  variants: { stock: number; lowStockThreshold: number }[];
};

export function ProductsTable({ products }: { products: Product[] }) {
  const t = useTranslations("products");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const allSelected = products.length > 0 && selected.size === products.length;
  const someSelected = selected.size > 0;

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(products.map((p) => p.id)) : new Set());
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  function handleBulkActivate(isActive: boolean) {
    startTransition(async () => {
      await bulkSetProductsActive([...selected], isActive);
      setSelected(new Set());
      router.refresh();
    });
  }

  function handleBulkDelete() {
    startTransition(async () => {
      const result = await bulkDeleteProducts([...selected]);
      setSelected(new Set());
      setBulkDeleteOpen(false);
      toast.info(
        t("bulkDeleteResult", {
          deleted: result.deletedCount,
          skipped: result.skippedCount,
        }),
      );
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {someSelected && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/50 px-3 py-2">
          <span className="text-sm font-medium">
            {t("selectedCount", { count: selected.size })}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => handleBulkActivate(true)}
            >
              {t("activateSelected")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => handleBulkActivate(false)}
            >
              {t("deactivateSelected")}
            </Button>
            <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" size="sm" disabled={pending}>
                  {t("deleteSelected")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("bulkDeleteConfirmTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("bulkDeleteConfirmDescription")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleBulkDelete} disabled={pending}>
                    {tCommon("delete")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(checked) => toggleAll(checked === true)}
                aria-label={t("selectAll")}
              />
            </TableHead>
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
                <Checkbox
                  checked={selected.has(product.id)}
                  onCheckedChange={(checked) => toggleOne(product.id, checked === true)}
                  aria-label={t("selectProduct", { name: product.name })}
                />
              </TableCell>
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
                {!product.isActive && <Badge variant="secondary">{t("inactive")}</Badge>}
              </TableCell>
              <TableCell className="text-end">
                <DeleteProductButton productId={product.id} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
