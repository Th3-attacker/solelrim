import { Warning } from "@phosphor-icons/react/dist/ssr";
import { getTranslations, getFormatter } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LicenseStatus } from "@/lib/shop/license";

// Purely a visual nudge (see lib/shop/license.ts) — renders nothing for
// "ok"/"unrestricted", so most boutiques never see this at all. Shown to
// both roles: the superadmin sees it too while viewing whichever boutique
// they're currently scoped to, in addition to the full cross-boutique table
// on Réglages globaux (components/settings/boutique-license-manager.tsx).
export async function LicenseWarningBanner({
  status,
  expiresAt,
}: {
  status: LicenseStatus;
  expiresAt: Date | null;
}) {
  if (status === "ok" || status === "unrestricted") {
    return null;
  }

  const [t, format] = await Promise.all([getTranslations("settings"), getFormatter()]);
  const isExpired = status === "expired";
  const variant = isExpired ? "destructive" : "warning";

  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b px-4 py-2 text-sm md:px-6",
        isExpired ? "bg-destructive/5" : "bg-warning/5",
      )}
    >
      <Badge variant={variant} className="gap-1">
        <Warning className="size-3" />
        {t(`licenseStatus.${status}`)}
      </Badge>
      <span className="text-muted-foreground">
        {status === "expired"
          ? t("licenseBannerExpired", {
              date: format.dateTime(expiresAt!, { dateStyle: "medium" }),
            })
          : t("licenseBannerExpiringSoon", {
              date: format.dateTime(expiresAt!, { dateStyle: "medium" }),
            })}
      </span>
    </div>
  );
}
