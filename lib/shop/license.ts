import { differenceInCalendarDays } from "date-fns";
import type { LicenseStatus, LicenseType } from "@/lib/generated/prisma/enums";

export type { LicenseStatus, LicenseType };

// How long after licenseExpiresAt a MONTHLY/YEARLY boutique keeps working
// before actually being blocked — gives a merchant time to pay without an
// instant cutoff on the day it lapses. Never applies to PERPETUAL (never
// expires) or SUSPENDED/CANCELLED (both take effect immediately).
export const LICENSE_GRACE_PERIOD_DAYS = 3;

// How many days before licenseExpiresAt the admin dashboard starts warning.
export const LICENSE_EXPIRING_SOON_DAYS = 7;

export type LicenseInfo = {
  licenseType: LicenseType;
  licenseStatus: LicenseStatus;
  licenseExpiresAt: Date | null;
};

// The single source of truth for "what state is this boutique's license
// actually in" — combines the superadmin's manual switch (licenseStatus:
// ACTIVE/SUSPENDED/CANCELLED, the only three ever written to the DB, see
// updateBoutiqueLicense in lib/actions/settings.ts) with the two states
// derived purely from today's date (GRACE_PERIOD/EXPIRED). There's no cron
// flipping a row to EXPIRED as its date passes — every caller re-derives
// this fresh instead, so it can never go stale.
export function getEffectiveLicenseState(
  license: LicenseInfo,
  now = new Date(),
): LicenseStatus {
  if (license.licenseStatus === "CANCELLED") return "CANCELLED";
  if (license.licenseStatus === "SUSPENDED") return "SUSPENDED";

  // A PERPETUAL license, or one with no expiration date set at all (not yet
  // put on a plan — every pre-existing boutique before this migration),
  // never lapses on its own. Only an explicit SUSPENDED/CANCELLED switch
  // above can stop it.
  if (license.licenseType === "PERPETUAL" || !license.licenseExpiresAt) {
    return "ACTIVE";
  }

  const daysLeft = differenceInCalendarDays(license.licenseExpiresAt, now);
  if (daysLeft >= 0) return "ACTIVE";
  if (daysLeft >= -LICENSE_GRACE_PERIOD_DAYS) return "GRACE_PERIOD";
  return "EXPIRED";
}

// States where the storefront must be taken down and every sensitive admin
// action rejected server-side — see (shop)/layout.tsx and
// lib/shop/admin-scope.ts (requireWritableAdminScope). GRACE_PERIOD is
// deliberately excluded: it's a warning window before SUSPENDED/EXPIRED,
// not a block in itself.
const BLOCKING_STATES: ReadonlySet<LicenseStatus> = new Set([
  "SUSPENDED",
  "EXPIRED",
  "CANCELLED",
]);

export function isLicenseBlocking(state: LicenseStatus): boolean {
  return BLOCKING_STATES.has(state);
}

// True once the dashboard should surface a banner at all — any state other
// than a comfortably-ACTIVE one, including ACTIVE-but-within-the-warning-
// window ahead of a MONTHLY/YEARLY expiration.
export function isLicenseWarning(
  state: LicenseStatus,
  license: LicenseInfo,
  now = new Date(),
): boolean {
  if (state !== "ACTIVE") return true;
  if (license.licenseType === "PERPETUAL" || !license.licenseExpiresAt) {
    return false;
  }
  const daysLeft = differenceInCalendarDays(license.licenseExpiresAt, now);
  return daysLeft <= LICENSE_EXPIRING_SOON_DAYS;
}

// Shared by boutique-license-manager.tsx (superadmin, cross-boutique table)
// and my-boutique-summary.tsx (either role, their own boutique) so the same
// state always reads the same color everywhere in the admin.
export const LICENSE_STATUS_BADGE_VARIANT: Record<
  LicenseStatus,
  "outline" | "warning" | "destructive"
> = {
  ACTIVE: "outline",
  GRACE_PERIOD: "warning",
  SUSPENDED: "destructive",
  EXPIRED: "destructive",
  CANCELLED: "destructive",
};
