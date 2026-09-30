"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "all";
const SYNC_DEBOUNCE_MS = 400;

type Filters = { from: string; to: string; status: string; payment: string; q: string };

function readFilters(params: URLSearchParams): Filters {
  return {
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
    status: params.get("status") ?? "",
    payment: params.get("payment") ?? "",
    q: params.get("q") ?? "",
  };
}

// Same debounced URL-sync pattern as the audit log filters: the server page
// reads the URL, so every filter is shareable and survives a refresh.
export function MySalesFilters({ walletProviders }: { walletProviders: string[] }) {
  const t = useTranslations("mySales");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => readFilters(searchParams));
  const [syncing, startSync] = useTransition();
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const handle = setTimeout(() => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) {
        if (value) params.set(key, value);
      }
      const query = params.toString();
      startSync(() => router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false }));
    }, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [filters, pathname, router]);

  const set = (key: keyof Filters) => (value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value === ALL ? "" : value }));
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:items-end">
      <div className="col-span-2 flex flex-col gap-2 sm:col-span-3 lg:col-span-2">
        <Label htmlFor="my-sales-q">{t("reference")}</Label>
        <div className="relative">
          {syncing ? (
            <Spinner className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          ) : (
            <MagnifyingGlass className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          )}
          <Input
            id="my-sales-q"
            className="ps-9"
            placeholder="VNT-..."
            value={filters.q}
            onChange={(e) => set("q")(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="my-sales-from">{t("from")}</Label>
        <Input
          id="my-sales-from"
          type="date"
          value={filters.from}
          max={filters.to || undefined}
          onChange={(e) => set("from")(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="my-sales-to">{t("to")}</Label>
        <Input
          id="my-sales-to"
          type="date"
          value={filters.to}
          min={filters.from || undefined}
          onChange={(e) => set("to")(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>{t("status")}</Label>
        <Select value={filters.status || ALL} onValueChange={set("status")}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("allStatuses")}</SelectItem>
            <SelectItem value="COMPLETED">{t("statusCompleted")}</SelectItem>
            <SelectItem value="CANCELLED">{t("statusCancelled")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label>{t("payment")}</Label>
        <Select value={filters.payment || ALL} onValueChange={set("payment")}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("allPayments")}</SelectItem>
            <SelectItem value="cash">{t("cash")}</SelectItem>
            {walletProviders.map((provider) => (
              <SelectItem key={provider} value={`wallet:${provider}`}>
                {provider}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="col-span-2 justify-self-start sm:col-span-3 lg:col-span-6"
          onClick={() => setFilters({ from: "", to: "", status: "", payment: "", q: "" })}
        >
          {tCommon("resetFilters")}
        </Button>
      )}
    </div>
  );
}
