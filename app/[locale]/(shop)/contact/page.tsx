import type { Metadata } from "next";
import { MessageCircle, Package, Share2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getStoreSettings } from "@/lib/queries/settings";
import { buildOrderQuestionWhatsAppLink, buildWhatsAppLink } from "@/lib/shop/contact";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contact");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function ContactPage() {
  const [t, settings] = await Promise.all([
    getTranslations("contact"),
    getStoreSettings(),
  ]);

  const adminNumber = settings.adminWhatsappNumber?.trim();
  const whatsappHref = adminNumber ? buildWhatsAppLink(adminNumber) : null;
  const orderWhatsappHref = adminNumber ? buildOrderQuestionWhatsAppLink(adminNumber) : null;

  const socialLinks = [
    { href: settings.instagramUrl?.trim(), label: "Instagram" },
    { href: settings.facebookUrl?.trim(), label: "Facebook" },
    { href: settings.tiktokUrl?.trim(), label: "TikTok" },
  ].filter((social): social is { href: string; label: string } => Boolean(social.href));

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

      <div className="grid gap-4 sm:grid-cols-3">
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
                  key={social.label}
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
