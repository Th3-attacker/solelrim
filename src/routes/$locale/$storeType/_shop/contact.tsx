import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ChatCircle, Package, ShareNetwork } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { shopPageBoundaries } from "@/components/errors/shop-boundaries";
import { resolveMetadata } from "@/lib/seo/head";
import { buildOrderQuestionWhatsAppLink, buildWhatsAppLink } from "@/lib/shop/contact";
import { getShopPageContext, shopPageMetadata } from "@/src/server/shop";
import { stringFields } from "@/src/server/validators";

// Ex-app/[locale]/[storeType]/(shop)/contact/page.tsx.

const loadContact = createServerFn({ method: "GET" })
  .validator(stringFields("storeType"))
  .handler(async ({ data: { storeType } }) => {
    const context = await getShopPageContext(storeType);
    const t = await getTranslations("contact");
    const title = `${t("metaTitle")} — ${context.siteName}`;
    const description = t("metaDescription", { siteName: context.siteName });
    const { boutique } = context;
    const adminNumber = boutique.adminWhatsappNumber?.trim();

    return {
      meta: resolveMetadata(
        shopPageMetadata(context, { storeType, path: "/contact", title, description }),
      ),
      whatsappHref: adminNumber ? buildWhatsAppLink(adminNumber) : null,
      orderWhatsappHref: adminNumber ? buildOrderQuestionWhatsAppLink(adminNumber) : null,
      socialLinks: boutique.socialLinks.map((link) => ({
        id: link.id,
        href: link.url,
        label: link.platform,
      })),
    };
  });

export const Route = createFileRoute("/$locale/$storeType/_shop/contact")({
  loader: ({ params }) => loadContact({ data: { storeType: params.storeType } }),
  component: ContactPage,
  ...shopPageBoundaries,
});

function ContactPage() {
  const { whatsappHref, orderWhatsappHref, socialLinks } = Route.useLoaderData();
  const t = useTranslations("contact");

  return (
    <div className="flex flex-col gap-10 py-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-heading-md text-balance sm:text-heading-lg">{t("title")}</h1>
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
            className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-8 text-center transition-colors hover:bg-muted"
          >
            <ChatCircle className="size-8 text-primary" />
            <p className="text-heading-xs">{t("whatsappTitle")}</p>
            <p className="text-paragraph-sm text-muted-foreground">{t("whatsappDesc")}</p>
          </a>
        )}

        {orderWhatsappHref && (
          <a
            href={orderWhatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-8 text-center transition-colors hover:bg-muted"
          >
            <Package className="size-8 text-primary" />
            <p className="text-heading-xs">{t("orderTitle")}</p>
            <p className="text-paragraph-sm text-muted-foreground">{t("orderDesc")}</p>
          </a>
        )}

        {socialLinks.length > 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-8 text-center">
            <ShareNetwork className="size-8 text-primary" />
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
