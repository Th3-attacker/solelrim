import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

export function OrderStatusBadge({
  status,
}: {
  status:
    | "PENDING"
    | "CONFIRMED"
    | "SHIPPING"
    | "DELIVERED"
    | "REJECTED"
    | "CANCELLED";
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

  if (status === "SHIPPING") {
    return (
      <Badge
        variant="outline"
        className="border-sky-300 text-sky-700 dark:border-sky-800 dark:text-sky-400"
      >
        {t("shipping")}
      </Badge>
    );
  }

  if (status === "DELIVERED") {
    return (
      <Badge className="border-0 bg-emerald-600 text-white dark:bg-emerald-500">
        {t("delivered")}
      </Badge>
    );
  }

  if (status === "REJECTED") {
    return <Badge variant="destructive">{t("rejected")}</Badge>;
  }

  if (status === "CANCELLED") {
    return (
      <Badge
        variant="outline"
        className="border-border text-muted-foreground"
      >
        {t("cancelled")}
      </Badge>
    );
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
