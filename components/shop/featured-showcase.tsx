import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { FeaturedShowcaseScroller } from "@/components/shop/featured-showcase-scroller";
import { SectionTitle } from "@/components/shop/section-title";
import { getProductImageUrl } from "@/lib/supabase/storage";
import type { getActiveProducts } from "@/lib/queries/shop";

type Product = Awaited<ReturnType<typeof getActiveProducts>>[number];

// Editorial highlight for the best-sellers (Product.isFeatured, recomputed
// in deliverOrder() and already capped at 5 there) — one horizontally
// scrollable row of big cards, same as the reference: ~3 visible at once on
// desktop, one (plus a peek of the next) on mobile.
export async function FeaturedShowcase({
  products,
  storeType,
}: {
  products: Product[];
  storeType: string;
}) {
  if (products.length === 0) return null;
  const t = await getTranslations("shop");

  const cards = products.map((product) => (
    <div
      key={product.id}
      className="group flex w-[62%] shrink-0 snap-start flex-col gap-3 sm:w-[46%] sm:gap-4 desktop:w-[31%]"
    >
      <div className="relative aspect-4/5 w-full overflow-hidden rounded-2xl bg-muted">
        {product.images[0] ? (
          <Image
            src={getProductImageUrl(product.images[0].storagePath)}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 62vw, (max-width: 960px) 46vw, 31vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            Solelrim
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          {product.category.name}
        </span>
        <h3 className="text-base font-semibold text-balance sm:text-xl">{product.name}</h3>
      </div>
      <Button asChild size="lg" className="w-full">
        <Link href={`/${storeType}/products/${product.slug}`}>
          {t("heroShopProduct")}
        </Link>
      </Button>
    </div>
  ));

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 flex flex-col gap-6 duration-700">
      <SectionTitle>{t("featuredShowcaseTitle")}</SectionTitle>
      <FeaturedShowcaseScroller>{cards}</FeaturedShowcaseScroller>
    </div>
  );
}
