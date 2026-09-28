// Per-boutique feature flags — server-enforced, not just a hidden button in
// the admin UI. Each flag is its own StoreType column (mirrors the existing
// testimonialsEnabled precedent) rather than a generic JSON blob: adding a
// new one is a migration + one line here, and every caller stays type-safe.
//
// Read directly off whatever StoreType row the caller already has (no extra
// query) — the checkout path and the admin promo-code actions both already
// load the boutique row before they'd need this.
export type FeatureFlags = {
  coupons: boolean;
};

export function getFeatureFlags(boutique: { couponsEnabled: boolean }): FeatureFlags {
  return {
    coupons: boutique.couponsEnabled,
  };
}
