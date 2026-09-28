import { Warning } from "@phosphor-icons/react/dist/ssr";
import { getTranslations, getFormatter } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getEffectiveLicenseState,
  isLicenseBlocking,
  isLicenseWarning,
  type LicenseInfo,
} from "@/lib/shop/license";

// Renders nothing once the license is comfortably ACTIVE — most boutiques
// never see this at all. Shown to both roles: the superadmin sees it too
// while viewing whichever boutique they're currently scoped to, in addition
// to the full cross-boutique table on Réglages globaux
// (components/settings/boutique-license-manager.tsx).
//
// Unlike before, this is no longer purely visual for a BOUTIQUE_ADMIN: once
// the state is one isLicenseBlocking() flags, every sensitive write action
// is actually rejected server-side (lib/shop/admin-scope.ts:
// requireWritableAdminScope) — the banner's copy says so rather than just
// warning about an upcoming date.
export async function LicenseWarningBanner({ license }: { license: LicenseInfo }) {
  const state = getEffectiveLicenseState(license);
  if (!isLicenseWarning(state, license)) {
    return null;
  }

  const [t, format] = await Promise.all([getTranslations("settings"), getFormatter()]);
  const blocking = isLicenseBlocking(state);
  const variant = blocking ? "destructive" : "warning";
  const expiresAt = license.licenseExpiresAt;

  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b px-4 py-2 text-sm md:px-6",
        blocking ? "bg-destructive/5" : "bg-warning/5",
      )}
    >
      <Badge variant={variant} className="gap-1">
        <Warning className="size-3" />
        {t(`licenseStatus.${state}`)}
      </Badge>
      <span className="text-muted-foreground">
        {state === "SUSPENDED" && t("licenseBannerSuspended")}
        {state === "CANCELLED" && t("licenseBannerCancelled")}
        {state === "EXPIRED" &&
          t("licenseBannerExpired", {
            date: format.dateTime(expiresAt!, { dateStyle: "medium" }),
          })}
        {state === "GRACE_PERIOD" &&
          t("licenseBannerGracePeriod", {
            date: format.dateTime(expiresAt!, { dateStyle: "medium" }),
          })}
        {state === "ACTIVE" &&
          t("licenseBannerExpiringSoon", {
            date: format.dateTime(expiresAt!, { dateStyle: "medium" }),
          })}
      </span>
    </div>
  );
}
