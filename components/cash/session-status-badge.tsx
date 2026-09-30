"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

export function SessionStatusBadge({ status }: { status: "OPEN" | "CLOSED" }) {
  const t = useTranslations("cash");
  return (
    <Badge variant={status === "OPEN" ? "default" : "secondary"}>
      {t(status === "OPEN" ? "statusOpen" : "statusClosed")}
    </Badge>
  );
}
