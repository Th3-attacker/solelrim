import type { LicenseType } from "@/lib/generated/prisma/enums";

// SOLAL's own (the Concédant's) contact info for section 34 of the license
// contract lives in the database (SolalContact, "singleton" row) instead of
// a hardcoded constant — see lib/queries/settings.ts: getSolalContact and
// components/settings/solal-contact-form.tsx. A superadmin fills it in
// from Réglages globaux, no code change/redeploy needed.

// Bumped whenever the legal text in license-contract-document.tsx changes
// in a way that matters (not for typo fixes) — printed on every generated
// contract so a signed copy can be matched back to the terms it was signed
// under.
export const LICENSE_TERMS_VERSION = "1.0";
export const LICENSE_TERMS_UPDATED_AT = "2026-09-22";

// Sections 11/12/13 of the license terms — fixed pricing per plan, in MRU
// (Mauritanian ouguiya). Not stored per-boutique: same terms for every
// client unless a separate written commercial agreement overrides them
// (section 7), which is out of scope for the auto-generated contract.
export const LICENSE_PRICING: Record<
  LicenseType,
  { installationFee: number; recurringFee: number; recurringLabel: "month" | "year" | null }
> = {
  MONTHLY: { installationFee: 10_000, recurringFee: 3_000, recurringLabel: "month" },
  YEARLY: { installationFee: 10_000, recurringFee: 30_000, recurringLabel: "year" },
  PERPETUAL: { installationFee: 25_000, recurringFee: 150_000, recurringLabel: null },
};
