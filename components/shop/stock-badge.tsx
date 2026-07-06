import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { StockStatus } from "@/lib/shop/stock";

export function StockBadge({ status }: { status: StockStatus }) {
  const t = useTranslations("shop");

  if (status === "in") return null;

  if (status === "out") {
    return <Badge variant="destructive">{t("outOfStock")}</Badge>;
  }

  return (
    <Badge
      variant="outline"
      className="border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400"
    >
      {t("lowStock")}
    </Badge>
  );
}
