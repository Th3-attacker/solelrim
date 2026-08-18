import { FeaturedShowcase } from "@/components/shop/featured-showcase";
import { HeroSection } from "@/components/shop/hero-section";
import { ProductCard } from "@/components/shop/product-card";
import { SectionTitle } from "@/components/shop/section-title";
import { TestimonialsSection } from "@/components/shop/testimonials-section";
import { TrustBadges } from "@/components/shop/trust-badges";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { getPublicBoutiqueSettings } from "@/lib/queries/settings";
import { getActiveProducts } from "@/lib/queries/shop";
import { resolveBoutiqueText } from "@/lib/shop/localized-boutique-text";
import { getStorefrontBasePath } from "@/lib/shop/storefront-path";
import { ArrowRight, PackageSearch } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

// Just a teaser on the homepage — the full catalog with search/filters
// lives on its own page (/{storeType}/products) behind "Voir plus".
const PREVIEW_COUNT = 8;

export default async function ShopHomePage({
  params,
}: {
  params: Promise<{ storeType: string }>;
}) {
  const { storeType } = await params;
  const [t, boutique, basePath, locale] = await Promise.all([
    getTranslations("shop"),
    getPublicBoutiqueSettings(storeType),
    getStorefrontBasePath(storeType),
    getLocale(),
  ]);
  const allProducts = await getActiveProducts(storeType);

  const previewProducts = allProducts.slice(0, PREVIEW_COUNT);
  const featuredProducts = allProducts.filter((p) => p.isFeatured).slice(0, 5);
  const { heroTitle, heroSubtitle } = resolveBoutiqueText(boutique, locale);

  return (
    <div className="flex flex-col gap-14">
      <HeroSection
        settings={{ ...boutique, heroTitle, heroSubtitle }}
        basePath={basePath}
      />

      <FeaturedShowcase products={featuredProducts} basePath={basePath} />

      <div className="flex flex-col items-center gap-6">
        <SectionTitle>{t("allProductsTitle")}</SectionTitle>

        {previewProducts.length === 0 ? (
          <StateMessage icon={PackageSearch} title={t("noProducts")} />
        ) : (
          <>
            <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 desktop:grid-cols-4 desktop:gap-4">
              {previewProducts.map((product, index) => (
                <div
                  key={product.id}
                  style={{ animationDelay: `${Math.min(index, 7) * 60}ms` }}
                  className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out"
                >
                  <ProductCard
                    product={product}
                    basePath={basePath}
                    priority={index < 4}
                    cardVariant={boutique.cardVariant}
                  />
                </div>
              ))}
            </div>
            <Link
              href={`${basePath}/products`}
              className="group flex items-center gap-2 text-sm font-semibold tracking-wide uppercase transition-colors hover:text-primary"
            >
              {t("loadMore")}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
            </Link>
          </>
        )}
      </div>
      
      {boutique.testimonialsEnabled && (
        <TestimonialsSection testimonials={boutique.testimonials} />
      )}

      <TrustBadges />
    </div>
  );
}
