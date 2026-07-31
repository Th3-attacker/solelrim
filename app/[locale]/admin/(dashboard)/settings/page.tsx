import { getTranslations } from "next-intl/server";
import { getStoreSettings } from "@/lib/queries/settings";
import { getStoreLogoUrl, getStoreHeroImageUrl } from "@/lib/supabase/storage";
import { SettingsForm } from "@/components/settings/settings-form";
import { LogoUpload } from "@/components/settings/logo-upload";
import { HeroImageUpload } from "@/components/settings/hero-image-upload";
import { ThemePicker } from "@/components/settings/theme-picker";
import { ProductTypePicker } from "@/components/settings/product-type-picker";
import { THEME_PRESETS } from "@/lib/theme/presets";

export default async function SettingsPage() {
  const [t, settings] = await Promise.all([
    getTranslations("settings"),
    getStoreSettings(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <ProductTypePicker currentProductType={settings.productType} />
      <LogoUpload
        logoUrl={
          settings.logoStoragePath
            ? getStoreLogoUrl(settings.logoStoragePath)
            : null
        }
      />
      <HeroImageUpload
        heroImageUrl={
          settings.heroImagePath
            ? getStoreHeroImageUrl(settings.heroImagePath)
            : null
        }
      />
      <ThemePicker presets={THEME_PRESETS} currentThemeId={settings.themeId} />
      <SettingsForm
        defaultValues={{
          bankilyNumber: settings.bankilyNumber ?? "",
          masrivyNumber: settings.masrivyNumber ?? "",
          adminWhatsappNumber: settings.adminWhatsappNumber ?? "",
          paymentInstructions: settings.paymentInstructions ?? "",
          siteName: settings.siteName ?? "",
          announcementText: settings.announcementText ?? "",
          heroTitle: settings.heroTitle ?? "",
          heroSubtitle: settings.heroSubtitle ?? "",
          heroBadgeText: settings.heroBadgeText ?? "",
          heroCtaLabel: settings.heroCtaLabel ?? "",
          heroImagePosition:
            settings.heroImagePosition === "left" ? "left" : "right",
          seoTitle: settings.seoTitle ?? "",
          seoDescription: settings.seoDescription ?? "",
          instagramUrl: settings.instagramUrl ?? "",
          facebookUrl: settings.facebookUrl ?? "",
          tiktokUrl: settings.tiktokUrl ?? "",
        }}
      />
    </div>
  );
}
