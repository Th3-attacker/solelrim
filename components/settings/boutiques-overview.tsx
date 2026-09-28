import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatPriceNumber } from "@/lib/format/currency";
import { LICENSE_PRICING } from "@/lib/legal/license-terms";
import {
  getEffectiveLicenseState,
  type LicenseInfo,
  type LicenseStatus,
} from "@/lib/shop/license";

type Boutique = LicenseInfo;

// Superadmin-only overview at the top of Réglages globaux — every boutique
// the superadmin manages, at a glance, plus a small price recap. This is
// the one place that sees across boutiques; a BOUTIQUE_ADMIN never reaches
// this page (app/[locale]/admin/(dashboard)/settings/global/page.tsx is
// gated by requireSuperAdminPage). The detailed per-boutique table right
// below it (BoutiqueLicenseManager) is where each row gets managed — this
// card is just the summary above it.
export async function BoutiquesOverview({ storeTypes }: { storeTypes: Boutique[] }) {
  const t = await getTranslations("boutiquesOverview");

  const statusCounts: Record<LicenseStatus, number> = {
    ACTIVE: 0,
    GRACE_PERIOD: 0,
    SUSPENDED: 0,
    EXPIRED: 0,
    CANCELLED: 0,
  };
  const byType = { MONTHLY: 0, YEARLY: 0, PERPETUAL: 0 };
  let perpetualRevenue = 0;

  for (const storeType of storeTypes) {
    statusCounts[getEffectiveLicenseState(storeType)]++;
    byType[storeType.licenseType]++;
    if (storeType.licenseType === "PERPETUAL") {
      perpetualRevenue +=
        LICENSE_PRICING.PERPETUAL.installationFee + LICENSE_PRICING.PERPETUAL.recurringFee;
    }
  }

  const monthlyRecurring = byType.MONTHLY * LICENSE_PRICING.MONTHLY.recurringFee;
  const yearlyRecurring = byType.YEARLY * LICENSE_PRICING.YEARLY.recurringFee;
  // Standard MRR normalization — a yearly plan's fee spread over its 12
  // months — so a mix of monthly and yearly boutiques still rolls up into
  // one comparable "how much per month" figure. Rounded since a fraction of
  // MRU isn't meaningful here.
  const monthlyRecurringRevenue = monthlyRecurring + Math.round(yearlyRecurring / 12);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <RevenueTile
            label={t("mrr")}
            value={`${formatPriceNumber(monthlyRecurringRevenue)} MRU`}
            hint={t("mrrHint")}
          />
          <RevenueTile
            label={t("perpetualCollected")}
            value={`${formatPriceNumber(perpetualRevenue)} MRU`}
            hint={t("perpetualCollectedHint")}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label={t("total")} value={storeTypes.length} />
          <Stat label={t("statusActive")} value={statusCounts.ACTIVE} tone="ok" />
          <Stat label={t("statusGrace")} value={statusCounts.GRACE_PERIOD} tone="warn" />
          <Stat
            label={t("statusBlocked")}
            value={statusCounts.SUSPENDED + statusCounts.EXPIRED + statusCounts.CANCELLED}
            tone="bad"
          />
          <Stat label={t("statusPerpetual")} value={byType.PERPETUAL} />
        </div>

        <div className="flex flex-col gap-2 border-t pt-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t("pricingRecap")}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <PriceLine
              label={t("monthlyRecap", { count: byType.MONTHLY })}
              value={t("perMonth", { amount: formatPriceNumber(monthlyRecurring) })}
            />
            <PriceLine
              label={t("yearlyRecap", { count: byType.YEARLY })}
              value={t("perYear", { amount: formatPriceNumber(yearlyRecurring) })}
            />
            <PriceLine
              label={t("perpetualRecap", { count: byType.PERPETUAL })}
              value={t("collected", { amount: formatPriceNumber(perpetualRevenue) })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RevenueTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border bg-muted/30 p-3">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span className="text-2xl font-bold">{value}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn" | "bad";
}) {
  const toneClass =
    tone === "bad"
      ? "text-destructive"
      : tone === "warn"
        ? "text-warning"
        : "text-foreground";
  return (
    <div className="flex flex-col gap-0.5 rounded-md border p-2">
      <span className={`text-xl font-semibold ${toneClass}`}>{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function PriceLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
