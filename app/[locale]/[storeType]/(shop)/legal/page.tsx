import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { getPublicBoutiqueSettings } from "@/lib/queries/settings";
import { getStoreLogoUrl } from "@/lib/supabase/storage";
import { buildWhatsAppLink } from "@/lib/shop/contact";
import { buildSocialMetadata } from "@/lib/shop/metadata";
import { resolveBoutiqueText } from "@/lib/shop/localized-boutique-text";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ storeType: string }>;
}): Promise<Metadata> {
  const { storeType } = await params;
  const [t, tShop, locale, boutique] = await Promise.all([
    getTranslations("legal"),
    getTranslations("shop"),
    getLocale(),
    getPublicBoutiqueSettings(storeType),
  ]);
  const siteName = resolveBoutiqueText(boutique, locale).siteName?.trim() || tShop("siteName");
  const title = `${t("metaTitle")} — ${siteName}`;
  const description = t("metaDescription");
  const imageUrl = boutique.logoStoragePath
    ? getStoreLogoUrl(boutique.logoStoragePath)
    : null;

  return {
    title,
    description,
    ...buildSocialMetadata({
      title,
      description,
      imageUrl,
      locale,
      domain: boutique.domain,
      storeKey: storeType,
      path: "/legal",
      siteName,
    }),
  };
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-heading-xs">{title}</h2>
      <p className="text-paragraph-md text-muted-foreground">{body}</p>
    </div>
  );
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ storeType: string }>;
}) {
  const { storeType } = await params;
  const [t, tShop, locale, boutique] = await Promise.all([
    getTranslations("legal"),
    getTranslations("shop"),
    getLocale(),
    getPublicBoutiqueSettings(storeType),
  ]);
  const siteName = resolveBoutiqueText(boutique, locale).siteName?.trim() || tShop("siteName");
  const whatsappHref = boutique.adminWhatsappNumber
    ? buildWhatsAppLink(boutique.adminWhatsappNumber)
    : null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-10 py-6">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-heading-md text-balance sm:text-heading-lg">{t("title")}</h1>
        <p className="text-paragraph-md text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="flex flex-col gap-8">
        <Section title={t("identityTitle")} body={t("identityBody", { siteName })} />
        <Section title={t("ordersTitle")} body={t("ordersBody")} />
        <Section title={t("privacyTitle")} body={t("privacyBody")} />
        <Section title={t("returnsTitle")} body={t("returnsBody")} />
        <div className="flex flex-col gap-2">
          <h2 className="text-heading-xs">{t("contactTitle")}</h2>
          <p className="text-paragraph-md text-muted-foreground">
            {t("contactBody")}
            {whatsappHref && (
              <>
                {" "}
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {t("contactWhatsappLinkLabel")}
                </a>
                .
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
