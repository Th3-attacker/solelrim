import { describe, expect, it } from "vitest";
import {
  getEffectiveLicenseState,
  isLicenseBlocking,
  isLicenseWarning,
  LICENSE_GRACE_PERIOD_DAYS,
  type LicenseInfo,
} from "@/lib/shop/license";

const NOW = new Date("2026-06-15T00:00:00Z");

function daysFromNow(days: number): Date {
  const date = new Date(NOW);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function license(overrides: Partial<LicenseInfo> = {}): LicenseInfo {
  return {
    licenseType: "MONTHLY",
    licenseStatus: "ACTIVE",
    licenseExpiresAt: null,
    ...overrides,
  };
}

describe("getEffectiveLicenseState", () => {
  it("is ACTIVE when no expiration date was ever set (unrestricted)", () => {
    expect(getEffectiveLicenseState(license(), NOW)).toBe("ACTIVE");
  });

  it("is ACTIVE for a PERPETUAL license even with a past expiresAt", () => {
    const state = getEffectiveLicenseState(
      license({ licenseType: "PERPETUAL", licenseExpiresAt: daysFromNow(-100) }),
      NOW,
    );
    expect(state).toBe("ACTIVE");
  });

  it("is ACTIVE while the expiration date is still in the future", () => {
    const state = getEffectiveLicenseState(
      license({ licenseExpiresAt: daysFromNow(10) }),
      NOW,
    );
    expect(state).toBe("ACTIVE");
  });

  it("is GRACE_PERIOD just past expiration, within the grace window", () => {
    const state = getEffectiveLicenseState(
      license({ licenseExpiresAt: daysFromNow(-1) }),
      NOW,
    );
    expect(state).toBe("GRACE_PERIOD");
  });

  it("is EXPIRED once past the grace window", () => {
    const state = getEffectiveLicenseState(
      license({ licenseExpiresAt: daysFromNow(-(LICENSE_GRACE_PERIOD_DAYS + 1)) }),
      NOW,
    );
    expect(state).toBe("EXPIRED");
  });

  it("is SUSPENDED regardless of a still-valid expiresAt — the manual switch wins", () => {
    const state = getEffectiveLicenseState(
      license({ licenseStatus: "SUSPENDED", licenseExpiresAt: daysFromNow(30) }),
      NOW,
    );
    expect(state).toBe("SUSPENDED");
  });

  it("is CANCELLED regardless of licenseType/expiresAt — the manual switch wins", () => {
    const state = getEffectiveLicenseState(
      license({
        licenseStatus: "CANCELLED",
        licenseType: "PERPETUAL",
        licenseExpiresAt: null,
      }),
      NOW,
    );
    expect(state).toBe("CANCELLED");
  });
});

describe("isLicenseBlocking", () => {
  it("blocks SUSPENDED, EXPIRED, and CANCELLED", () => {
    expect(isLicenseBlocking("SUSPENDED")).toBe(true);
    expect(isLicenseBlocking("EXPIRED")).toBe(true);
    expect(isLicenseBlocking("CANCELLED")).toBe(true);
  });

  it("never blocks ACTIVE or GRACE_PERIOD", () => {
    expect(isLicenseBlocking("ACTIVE")).toBe(false);
    expect(isLicenseBlocking("GRACE_PERIOD")).toBe(false);
  });
});

describe("isLicenseWarning", () => {
  it("is false for a comfortably-ACTIVE unrestricted boutique", () => {
    expect(isLicenseWarning("ACTIVE", license(), NOW)).toBe(false);
  });

  it("is false for a PERPETUAL license", () => {
    const info = license({ licenseType: "PERPETUAL" });
    expect(isLicenseWarning("ACTIVE", info, NOW)).toBe(false);
  });

  it("is true once inside the expiring-soon window while still ACTIVE", () => {
    const info = license({ licenseExpiresAt: daysFromNow(3) });
    expect(isLicenseWarning("ACTIVE", info, NOW)).toBe(true);
  });

  it("is true for every non-ACTIVE state", () => {
    const info = license({ licenseExpiresAt: daysFromNow(-1) });
    expect(isLicenseWarning("GRACE_PERIOD", info, NOW)).toBe(true);
  });
});
