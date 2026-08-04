import type { Metadata } from "next";
import { MessageCircle, Package, Share2 } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { getPublicBoutiqueSettings } from "@/lib/queries/settings";
import { getStoreLogoUrl } from "@/lib/supabase/storage";
import { buildOrderQuestionWhatsAppLink, buildWhatsAppLink } from "@/lib/shop/contact";
import { buildSocialMetadata } from "@/lib/shop/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ storeType: string }>;
}): Promise<Metadata> {
  const { storeType } = await params;
  const [t, tShop, locale, boutique] = await Promise.all([
    getTranslations("contact"),
    getTranslations("shop"),
    getLocale(),
    getPublicBoutiqueSettings(storeType),
  ]);
  const siteName = boutique.siteName?.trim() || tShop("siteName");
  const title = `${t("metaTitle")} — ${siteName}`;
  const description = t("metaDescription");
  const imageUrl = boutique.logoStoragePath
    ? getStoreLogoUrl(boutique.logoStoragePath)
    : null;

  return {
    title,
    description,
    ...buildSocialMetadata({ title, description, imageUrl, locale }),
  };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ storeType: string }>;
}) {
  const { storeType } = await params;
  const [t, boutique] = await Promise.all([
    getTranslations("contact"),
    getPublicBoutiqueSettings(storeType),
  ]);

  const adminNumber = boutique.adminWhatsappNumber?.trim();
  const whatsappHref = adminNumber ? buildWhatsAppLink(adminNumber) : null;
  const orderWhatsappHref = adminNumber ? buildOrderQuestionWhatsAppLink(adminNumber) : null;

  const socialLinks = boutique.socialLinks.map((link) => ({
    id: link.id,
    href: link.url,
    label: link.platform,
  }));

  return (
    <div className="flex flex-col gap-10 py-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-heading-md text-balance sm:text-heading-lg">
          {t("title")}
        </h1>
        <p className="max-w-md text-paragraph-md text-muted-foreground sm:text-paragraph-lg">
          {t("subtitle")}
        </p>
      </div>

      <div className="grid gap-3 desktop:gap-4 sm:grid-cols-3">
        {whatsappHref && (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-3 rounded-2xl bg-muted/40 p-8 text-center transition-colors hover:bg-muted/70"
          >
            <MessageCircle className="size-8 text-primary" />
            <p className="text-heading-xs">{t("whatsappTitle")}</p>
            <p className="text-paragraph-sm text-muted-foreground">{t("whatsappDesc")}</p>
          </a>
        )}

        {orderWhatsappHref && (
          <a
            href={orderWhatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-3 rounded-2xl bg-muted/40 p-8 text-center transition-colors hover:bg-muted/70"
          >
            <Package className="size-8 text-primary" />
            <p className="text-heading-xs">{t("orderTitle")}</p>
            <p className="text-paragraph-sm text-muted-foreground">{t("orderDesc")}</p>
          </a>
        )}

        {socialLinks.length > 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-muted/40 p-8 text-center">
            <Share2 className="size-8 text-primary" />
            <p className="text-heading-xs">{t("socialTitle")}</p>
            <p className="text-paragraph-sm text-muted-foreground">{t("socialDesc")}</p>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-1">
              {socialLinks.map((social) => (
                <a
                  key={social.id}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium underline-offset-4 hover:underline"
                >
                  {social.label}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
