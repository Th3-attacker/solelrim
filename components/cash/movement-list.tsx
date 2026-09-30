"use client";

import { useFormatter, useTranslations } from "next-intl";
import { formatPrice } from "@/lib/format/currency";

export function MovementList({
  movements,
}: {
  movements: {
    id: string;
    type: "IN" | "OUT";
    amount: number;
    reason: string;
    createdAt: Date;
  }[];
}) {
  const t = useTranslations("cash");
  const tCommon = useTranslations("common");
  const format = useFormatter();

  if (movements.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noMovements")}</p>;
  }
  return (
    <ul className="flex flex-col divide-y text-sm">
      {movements.map((movement) => (
        <li key={movement.id} className="flex items-start justify-between gap-3 py-2">
          <div className="flex min-w-0 flex-col">
            <span className="break-words">{movement.reason}</span>
            <span className="text-xs text-muted-foreground">
              {t(movement.type === "IN" ? "cashIn" : "cashOut")} ·{" "}
              {format.dateTime(movement.createdAt, { timeStyle: "short" })}
            </span>
          </div>
          <span
            dir="ltr"
            className={
              movement.type === "IN"
                ? "shrink-0 font-medium tabular-nums"
                : "shrink-0 font-medium tabular-nums text-destructive"
            }
          >
            {movement.type === "IN" ? "+" : "-"}
            {formatPrice(movement.amount, tCommon("currency"))}
          </span>
        </li>
      ))}
    </ul>
  );
}
