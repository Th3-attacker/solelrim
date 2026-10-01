import { getTranslations } from "next-intl/server";
import { getBoutiqueSettings } from "@/lib/queries/settings";
import { getDeliveredOrders } from "@/lib/queries/orders";
import { getStoreHeroImageUrl, getStoreLogoUrl, getWalletLogoUrl } from "@/lib/supabase/storage";
import { getMfaStatus } from "@/lib/auth/mfa";
import { TwoFactorSettings } from "@/components/settings/two-factor-settings";
import { BoutiqueSettingsForm } from "@/components/settings/boutique-settings-form";
import { LogoUpload } from "@/components/settings/logo-upload";
import { HeroImageUpload } from "@/components/settings/hero-image-upload";
import { ThemePicker } from "@/components/settings/theme-picker";
import { ColorModePicker } from "@/components/settings/color-mode-picker";
import { LayoutVariantsPicker } from "@/components/settings/layout-variants-picker";
import { SocialLinksManager } from "@/components/settings/social-links-manager";
import { WalletAccountsManager } from "@/components/settings/wallet-accounts-manager";
import { TestimonialsManager } from "@/components/settings/testimonials-manager";
import { SellersManager } from "@/components/settings/sellers-manager";
import { LoyaltySettingsForm } from "@/components/settings/loyalty-settings-form";
import { listSellers } from "@/lib/queries/sellers";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { requireAdminScope } from "@/lib/shop/admin-scope";
import { THEME_PRESETS, DEFAULT_THEME_ID } from "@/lib/theme/presets";

// The settings sections that aren't a Card of their own sit in the same
// white panel, so each reads as its own block on the muted page.
function SettingsPanel({ children }: { children: React.ReactNode }) {
  return <section className="rounded-xl border bg-card p-4 sm:p-6">{children}</section>;
}

export default async function SettingsPage() {
  const [t, { admin, productType }] = await Promise.all([
    getTranslations("settings"),
    requireAdminScope(),
  ]);

  const [boutique, deliveredOrders, mfaStatus, sellers] = await Promise.all([
    getBoutiqueSettings(productType),
    getDeliveredOrders(productType),
    getMfaStatus(),
    listSellers(productType),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{boutique.label}</p>
        </div>
        {admin.role === "SUPERADMIN" && (
          <Button asChild variant="outline">
            <Link href="/admin/settings/global">{t("globalSettingsLink")}</Link>
          </Button>
        )}
      </div>

      {/* Tied to the logged-in admin's own Supabase Auth account, not to
          this boutique — shown regardless of which scope is selected. */}
      <TwoFactorSettings factorId={mfaStatus.factorId} required={mfaStatus.required} />

      <SettingsPanel>
        <SellersManager
          key={productType}
          productType={productType}
          sellers={sellers.sellers}
          quota={sellers.quota}
          canEditQuota={admin.role === "SUPERADMIN"}
        />
      </SettingsPanel>

      <SettingsPanel>
        <LoyaltySettingsForm
          key={`loyalty-${productType}`}
          rule={{
            enabled: boutique.loyaltyEnabled,
            spendPerPoint: boutique.loyaltySpendPerPoint,
            rewardPoints: boutique.loyaltyRewardPoints,
            rewardValue: boutique.loyaltyRewardValue,
          }}
        />
      </SettingsPanel>

      <SettingsPanel>
        <LogoUpload
          logoUrl={
            boutique.logoStoragePath ? getStoreLogoUrl(boutique.logoStoragePath) : null
          }
        />
      </SettingsPanel>

      <SettingsPanel>
        <HeroImageUpload
          heroImageUrl={
            boutique.heroImagePath ? getStoreHeroImageUrl(boutique.heroImagePath) : null
          }
        />
      </SettingsPanel>

      {(admin.role === "SUPERADMIN" || admin.canManageAppearance) && (
        <>
          <SettingsPanel>
            <ThemePicker
              presets={THEME_PRESETS}
              currentThemeId={boutique.themeId ?? DEFAULT_THEME_ID}
              customColor={boutique.customThemeColor}
            />
          </SettingsPanel>
          <SettingsPanel>

            <ColorModePicker currentMode={boutique.colorMode} />
          </SettingsPanel>

          <SettingsPanel>
            <LayoutVariantsPicker
              heroVariant={boutique.heroVariant}
              cardVariant={boutique.cardVariant}
              footerVariant={boutique.footerVariant}
            />
          </SettingsPanel>
        </>
      )}

      <BoutiqueSettingsForm
        heroVariant={boutique.heroVariant}
        defaultValues={{
          adminWhatsappNumber: boutique.adminWhatsappNumber ?? "",
          paymentInstructions: boutique.paymentInstructions ?? "",
          siteName: boutique.siteName ?? "",
          siteNameAr: boutique.siteNameAr ?? "",
          siteNameEn: boutique.siteNameEn ?? "",
          announcementText: boutique.announcementText ?? "",
          heroTitle: boutique.heroTitle ?? "",
          heroTitleAr: boutique.heroTitleAr ?? "",
          heroTitleEn: boutique.heroTitleEn ?? "",
          heroSubtitle: boutique.heroSubtitle ?? "",
          heroSubtitleAr: boutique.heroSubtitleAr ?? "",
          heroSubtitleEn: boutique.heroSubtitleEn ?? "",
          heroBadgeText: boutique.heroBadgeText ?? "",
          heroCtaLabel: boutique.heroCtaLabel ?? "",
          heroImagePosition: boutique.heroImagePosition === "left" ? "left" : "right",
          seoTitle: boutique.seoTitle ?? "",
          seoTitleAr: boutique.seoTitleAr ?? "",
          seoTitleEn: boutique.seoTitleEn ?? "",
          seoDescription: boutique.seoDescription ?? "",
          seoDescriptionAr: boutique.seoDescriptionAr ?? "",
          seoDescriptionEn: boutique.seoDescriptionEn ?? "",
        }}
      />

      <SettingsPanel>
        <WalletAccountsManager
          wallets={boutique.walletAccounts.map((wallet) => ({
            id: wallet.id,
            provider: wallet.provider,
            number: wallet.number,
            logoUrl: wallet.logoStoragePath ? getWalletLogoUrl(wallet.logoStoragePath) : null,
          }))}
        />
      </SettingsPanel>

      <SettingsPanel>
        <SocialLinksManager
          links={boutique.socialLinks.map((link) => ({
            id: link.id,
            platform: link.platform,
            url: link.url,
          }))}
        />
      </SettingsPanel>

      <SettingsPanel>
        <TestimonialsManager
          enabled={boutique.testimonialsEnabled}
          testimonials={boutique.testimonials.map((item) => ({
            id: item.id,
            customerName: item.customerName,
            quote: item.quote,
            rating: item.rating,
            orderId: item.orderId,
          }))}
          deliveredOrders={deliveredOrders}
        />
      </SettingsPanel>
    </div>
  );
}
