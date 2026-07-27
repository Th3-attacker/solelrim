import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { TrustBadges } from "@/components/shop/trust-badges";
import { getActiveProducts } from "@/lib/queries/shop";
import { getStoreSettings } from "@/lib/queries/settings";
import { getProductImageUrl } from "@/lib/supabase/storage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("about");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function AboutPage() {
  const [t, tShop, products, settings] = await Promise.all([
    getTranslations("about"),
    getTranslations("shop"),
    getActiveProducts(),
    getStoreSettings(),
  ]);

  const spotlight = products.filter((product) => product.images.length > 0).slice(0, 3);
  const whatsappHref = settings.adminWhatsappNumber
    ? `https://wa.me/${settings.adminWhatsappNumber.replace(/\D/g, "")}`
    : null;

  return (
    <div className="flex flex-col gap-16">
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <span className="rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-medium tracking-widest text-primary uppercase">
          {t("eyebrow")}
        </span>
        <h1 className="max-w-2xl text-heading-lg text-balance sm:text-heading-xl">
          {t("heroTitle")}
        </h1>
        <p className="max-w-lg text-paragraph-md text-muted-foreground sm:text-paragraph-lg">
          {t("heroSubtitle")}
        </p>
      </div>

      <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
        <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          {t("missionEyebrow")}
        </span>
        <h2 className="text-heading-sm text-balance sm:text-heading-md">
          {t("missionTitle")}
        </h2>
        <p className="text-paragraph-md text-muted-foreground sm:text-paragraph-lg">
          {t("missionBody")}
        </p>
      </div>

      {spotlight.length > 0 && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <span className="h-6 w-1.5 rounded-full bg-primary" />
            <div>
              <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
                {t("makeEyebrow")}
              </p>
              <h2 className="text-heading-xs">{t("makeTitle")}</h2>
            </div>
          </div>
          <p className="max-w-xl text-paragraph-md text-muted-foreground">{t("makeBody")}</p>
          <div className="grid gap-3 desktop:gap-4 sm:grid-cols-3">
            {spotlight.map((product) => (
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                className="group flex flex-col gap-2"
              >
                <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-muted">
                  <Image
                    src={getProductImageUrl(product.images[0].storagePath)}
                    alt={product.name}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, 33vw"
                  />
                </div>
                <div>
                  <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
                    {product.category.name}
                  </p>
                  <p className="font-medium">{product.name}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <span className="h-6 w-1.5 rounded-full bg-primary" />
          <div>
            <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
              {t("workEyebrow")}
            </p>
            <h2 className="text-heading-xs">{t("workTitle")}</h2>
          </div>
        </div>
        <TrustBadges />
      </div>

      <div className="flex flex-col items-center gap-6 rounded-3xl bg-muted/30 px-6 py-12 text-center">
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            {t("findEyebrow")}
          </span>
          <h2 className="text-heading-sm">{t("findTitle")}</h2>
          <p className="max-w-sm text-paragraph-md text-muted-foreground">{t("findBody")}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {whatsappHref && (
            <Button asChild size="lg">
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                {tShop("contactWhatsapp")}
              </a>
            </Button>
          )}
          <Button asChild size="lg" variant="outline">
            <Link href={{ pathname: "/", hash: "catalog" }}>{t("ctaButton")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
