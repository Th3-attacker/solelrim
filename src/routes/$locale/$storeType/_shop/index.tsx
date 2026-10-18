import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ArrowRight, Package } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { shopPageBoundaries } from "@/components/errors/shop-boundaries";
import { FeaturedShowcase } from "@/components/shop/featured-showcase";
import { HeroSection } from "@/components/shop/hero-section";
import { ProductCard } from "@/components/shop/product-card";
import { SectionTitle } from "@/components/shop/section-title";
import { TestimonialsSection } from "@/components/shop/testimonials-section";
import { TrustBadges } from "@/components/shop/trust-badges";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { getActiveProducts } from "@/lib/queries/shop";
import { resolveBoutiqueText } from "@/lib/shop/localized-boutique-text";
import { getShopPageContext } from "@/src/server/shop";
import { stringFields } from "@/src/server/validators";

// Ex-app/[locale]/[storeType]/(shop)/page.tsx.

// Just a teaser on the homepage — the full catalog with search/filters
// lives on its own page (/{storeType}/products) behind "Voir plus".
const PREVIEW_COUNT = 8;

const loadShopHome = createServerFn({ method: "GET" })
  .validator(stringFields("storeType"))
  .handler(async ({ data: { storeType } }) => {
    const { boutique, basePath, locale } = await getShopPageContext(storeType);
    const allProducts = await getActiveProducts(storeType);
    const { siteName, heroTitle, heroSubtitle } = resolveBoutiqueText(boutique, locale);

    return {
      basePath,
      // Seuls les champs du héros partent vers le navigateur, pas toute la boutique.
      heroSettings: {
        heroImagePath: boutique.heroImagePath,
        heroImagePosition: boutique.heroImagePosition,
        heroVariant: boutique.heroVariant,
        heroBadgeText: boutique.heroBadgeText,
        heroCtaLabel: boutique.heroCtaLabel,
        siteName,
        heroTitle,
        heroSubtitle,
      },
      previewProducts: allProducts.slice(0, PREVIEW_COUNT),
      featuredProducts: allProducts.filter((p) => p.isFeatured).slice(0, 5),
      cardVariant: boutique.cardVariant,
      testimonials: boutique.testimonialsEnabled ? boutique.testimonials : null,
    };
  });

export const Route = createFileRoute("/$locale/$storeType/_shop/")({
  loader: ({ params }) => loadShopHome({ data: { storeType: params.storeType } }),
  component: ShopHomePage,
  ...shopPageBoundaries,
});

function ShopHomePage() {
  const { basePath, heroSettings, previewProducts, featuredProducts, cardVariant, testimonials } =
    Route.useLoaderData();
  const t = useTranslations("shop");

  return (
    <div className="flex flex-col gap-14">
      <HeroSection settings={heroSettings} basePath={basePath} />

      <FeaturedShowcase products={featuredProducts} basePath={basePath} />

      <div className="flex flex-col items-center gap-6">
        <SectionTitle>{t("allProductsTitle")}</SectionTitle>

        {previewProducts.length === 0 ? (
          <StateMessage icon={Package} title={t("noProducts")} />
        ) : (
          <>
            <ul
              role="list"
              className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 desktop:grid-cols-4 desktop:gap-4"
            >
              {previewProducts.map((product, index) => (
                <li
                  key={product.id}
                  style={{ animationDelay: `${Math.min(index, 7) * 60}ms` }}
                  className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out"
                >
                  <ProductCard
                    product={product}
                    basePath={basePath}
                    priority={index < 4}
                    cardVariant={cardVariant}
                  />
                </li>
              ))}
            </ul>
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

      {testimonials && <TestimonialsSection testimonials={testimonials} />}

      <TrustBadges />
    </div>
  );
}
