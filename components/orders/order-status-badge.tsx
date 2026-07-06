import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

export function OrderStatusBadge({
  status,
}: {
  status: "PENDING" | "CONFIRMED" | "REJECTED";
}) {
  const t = useTranslations("orders");

  if (status === "CONFIRMED") {
    return (
      <Badge
        variant="outline"
        className="border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400"
      >
        {t("confirmed")}
      </Badge>
    );
  }

  if (status === "REJECTED") {
    return <Badge variant="destructive">{t("rejected")}</Badge>;
  }

  return (
    <Badge
      variant="outline"
      className="border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400"
    >
      {t("pending")}
    </Badge>
  );
}
