import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { StockStatus } from "@/lib/shop/stock";

export function StockBadge({ status }: { status: StockStatus }) {
  const t = useTranslations("shop");

  if (status === "in") return null;

  if (status === "out") {
    return <Badge variant="destructive">{t("outOfStock")}</Badge>;
  }

  return <Badge variant="warning">{t("lowStock")}</Badge>;
}
