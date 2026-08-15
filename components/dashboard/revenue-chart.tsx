"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { useTranslations } from "next-intl";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPrice } from "@/lib/format/currency";

const RANGE_DAYS: Record<string, number | null> = {
  all: null,
  "90d": 90,
  "30d": 30,
  "7d": 7,
};

export function RevenueChart({
  data,
}: {
  data: { day: string; total: number }[];
}) {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const [range, setRange] = useState<"all" | "90d" | "30d" | "7d">("90d");
  const revenueLabel = t("revenue");
  const chartConfig = {
    total: { label: revenueLabel, color: "var(--chart-1)" },
  } satisfies ChartConfig;

  const filtered = useMemo(() => {
    const days = RANGE_DAYS[range];
    if (days === null) return data;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffKey = cutoff.toISOString().slice(0, 10);
    return data.filter((row) => row.day >= cutoffKey);
  }, [data, range]);

  const rangeOptions = [
    { value: "all" as const, label: t("allTime") },
    { value: "90d" as const, label: t("last90Days") },
    { value: "30d" as const, label: t("last30Days") },
    { value: "7d" as const, label: t("last7Days") },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <ToggleGroup
          type="single"
          variant="outline"
          value={range}
          onValueChange={(value) => value && setRange(value as typeof range)}
          className="hidden sm:flex"
        >
          {rangeOptions.map((option) => (
            <ToggleGroupItem key={option.value} value={option.value}>
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <Select value={range} onValueChange={(value) => setRange(value as typeof range)}>
          <SelectTrigger className="w-40 sm:hidden">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {rangeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ChartContainer config={chartConfig} className="h-64 w-full">
        <AreaChart data={filtered}>
          <defs>
            <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-total)" stopOpacity={0.8} />
              <stop offset="95%" stopColor="var(--color-total)" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value: string) => value.slice(5)}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) => (
                  <div className="flex w-full items-center justify-between gap-4">
                    <span className="text-muted-foreground">{revenueLabel}</span>
                    <span className="font-mono font-medium text-foreground tabular-nums">
                      {formatPrice(Number(value), tCommon("currency"))}
                    </span>
                  </div>
                )}
              />
            }
          />
          <Area
            dataKey="total"
            type="natural"
            fill="url(#fillRevenue)"
            stroke="var(--color-total)"
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
