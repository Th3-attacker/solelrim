import { getTranslations } from "next-intl/server";
import { getBoutiqueSettings } from "@/lib/queries/settings";
import { getStoreHeroImageUrl, getStoreLogoUrl } from "@/lib/supabase/storage";
import { BoutiqueSettingsForm } from "@/components/settings/boutique-settings-form";
import { LogoUpload } from "@/components/settings/logo-upload";
import { HeroImageUpload } from "@/components/settings/hero-image-upload";
import { ThemePicker } from "@/components/settings/theme-picker";
import { SocialLinksManager } from "@/components/settings/social-links-manager";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { requireAdminScope } from "@/lib/shop/admin-scope";
import { THEME_PRESETS, DEFAULT_THEME_ID } from "@/lib/theme/presets";

export default async function SettingsPage() {
  const [t, { admin, productType }] = await Promise.all([
    getTranslations("settings"),
    requireAdminScope(),
  ]);

  const boutique = await getBoutiqueSettings(productType);

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

      <LogoUpload
        logoUrl={
          boutique.logoStoragePath ? getStoreLogoUrl(boutique.logoStoragePath) : null
        }
      />

      <HeroImageUpload
        heroImageUrl={
          boutique.heroImagePath ? getStoreHeroImageUrl(boutique.heroImagePath) : null
        }
      />

      <ThemePicker
        presets={THEME_PRESETS}
        currentThemeId={boutique.themeId ?? DEFAULT_THEME_ID}
      />

      <BoutiqueSettingsForm
        defaultValues={{
          bankilyNumber: boutique.bankilyNumber ?? "",
          masrivyNumber: boutique.masrivyNumber ?? "",
          adminWhatsappNumber: boutique.adminWhatsappNumber ?? "",
          paymentInstructions: boutique.paymentInstructions ?? "",
          siteName: boutique.siteName ?? "",
          announcementText: boutique.announcementText ?? "",
          heroTitle: boutique.heroTitle ?? "",
          heroSubtitle: boutique.heroSubtitle ?? "",
          heroBadgeText: boutique.heroBadgeText ?? "",
          heroCtaLabel: boutique.heroCtaLabel ?? "",
          heroImagePosition: boutique.heroImagePosition === "left" ? "left" : "right",
          seoTitle: boutique.seoTitle ?? "",
          seoDescription: boutique.seoDescription ?? "",
        }}
      />

      <SocialLinksManager
        links={boutique.socialLinks.map((link) => ({
          id: link.id,
          platform: link.platform,
          url: link.url,
        }))}
      />
    </div>
  );
}
