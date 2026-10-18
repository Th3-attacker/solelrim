import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { shopPageBoundaries } from "@/components/errors/shop-boundaries";
import { resolveMetadata } from "@/lib/seo/head";
import { buildWhatsAppLink } from "@/lib/shop/contact";
import { getShopPageContext, shopPageMetadata } from "@/src/server/shop";
import { stringFields } from "@/src/server/validators";

// Ex-app/[locale]/[storeType]/(shop)/legal/page.tsx.

const loadLegal = createServerFn({ method: "GET" })
  .validator(stringFields("storeType"))
  .handler(async ({ data: { storeType } }) => {
    const context = await getShopPageContext(storeType);
    const t = await getTranslations("legal");
    const title = `${t("metaTitle")} — ${context.siteName}`;
    const description = t("metaDescription");
    const { boutique } = context;

    return {
      meta: resolveMetadata(
        shopPageMetadata(context, { storeType, path: "/legal", title, description }),
      ),
      siteName: context.siteName,
      whatsappHref: boutique.adminWhatsappNumber
        ? buildWhatsAppLink(boutique.adminWhatsappNumber)
        : null,
    };
  });

export const Route = createFileRoute("/$locale/$storeType/_shop/legal")({
  loader: ({ params }) => loadLegal({ data: { storeType: params.storeType } }),
  component: LegalPage,
  ...shopPageBoundaries,
});

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-heading-xs">{title}</h2>
      <p className="text-paragraph-md text-muted-foreground">{body}</p>
    </div>
  );
}

function LegalPage() {
  const { siteName, whatsappHref } = Route.useLoaderData();
  const t = useTranslations("legal");

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
