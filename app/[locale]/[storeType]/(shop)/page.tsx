import { FeaturedShowcase } from "@/components/shop/featured-showcase";
import { HeroSection } from "@/components/shop/hero-section";
import { NewArrivals } from "@/components/shop/new-arrivals";
import { ProductCard } from "@/components/shop/product-card";
import { Reveal } from "@/components/shop/reveal";
import { SectionTitle } from "@/components/shop/section-title";
import { TrustBadges } from "@/components/shop/trust-badges";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { ArrowRight, PackageSearch } from "lucide-react";
import { getActiveProducts } from "@/lib/queries/shop";
import { getPublicBoutiqueSettings } from "@/lib/queries/settings";
import { isNewProduct } from "@/lib/shop/badges";
import { getTranslations } from "next-intl/server";

// Just a teaser on the homepage — the full catalog with search/filters
// lives on its own page (/{storeType}/products) behind "Voir plus".
const PREVIEW_COUNT = 8;
const NEW_ARRIVALS_COUNT = 4;

export default async function ShopHomePage({
  params,
}: {
  params: Promise<{ storeType: string }>;
}) {
  const { storeType } = await params;
  const [t, boutique] = await Promise.all([
    getTranslations("shop"),
    getPublicBoutiqueSettings(storeType),
  ]);
  const allProducts = await getActiveProducts(storeType);

  const previewProducts = allProducts.slice(0, PREVIEW_COUNT);
  const featuredProducts = allProducts.filter((p) => p.isFeatured).slice(0, 5);
  const newArrivals = allProducts
    .filter((p) => isNewProduct(p.createdAt))
    .slice(0, NEW_ARRIVALS_COUNT);

  return (
    <div className="flex flex-col gap-14">
      <HeroSection settings={boutique} storeType={storeType} />

      <FeaturedShowcase products={featuredProducts} storeType={storeType} />

      <NewArrivals products={newArrivals} storeType={storeType} />

      <div className="flex flex-col items-center gap-6">
        <SectionTitle>{t("allProductsTitle")}</SectionTitle>

        {previewProducts.length === 0 ? (
          <StateMessage icon={PackageSearch} title={t("noProducts")} />
        ) : (
          <>
            <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 desktop:grid-cols-4 desktop:gap-4">
              {previewProducts.map((product, index) => (
                <Reveal key={product.id} delay={Math.min(index, 7) * 60}>
                  <ProductCard
                    product={product}
                    storeType={storeType}
                    priority={index < 4}
                  />
                </Reveal>
              ))}
            </div>
            <Link
              href={`/${storeType}/products`}
              className="group flex items-center gap-2 text-sm font-semibold tracking-wide uppercase transition-colors hover:text-primary"
            >
              {t("loadMore")}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1 rtl:rotate-180" />
            </Link>
          </>
        )}
      </div>

      <TrustBadges />
    </div>
  );
}
