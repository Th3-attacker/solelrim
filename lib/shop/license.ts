import { differenceInCalendarDays } from "date-fns";

// Purely a visual nudge — the superadmin bumps this after a manual bank
// transfer (Bankily/Masrivi), same as every other payment in this app.
// Nothing ever gets blocked based on it; see components/settings/
// license-warning-banner.tsx and boutique-license-manager.tsx.
export const LICENSE_EXPIRING_SOON_DAYS = 7;

export type LicenseStatus = "unrestricted" | "ok" | "expiringSoon" | "expired";

export function getLicenseStatus(
  licenseExpiresAt: Date | null,
  now = new Date(),
): LicenseStatus {
  if (!licenseExpiresAt) return "unrestricted";
  const daysLeft = differenceInCalendarDays(licenseExpiresAt, now);
  if (daysLeft < 0) return "expired";
  if (daysLeft <= LICENSE_EXPIRING_SOON_DAYS) return "expiringSoon";
  return "ok";
}
