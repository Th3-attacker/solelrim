import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { HeroCarousel } from "@/components/shop/hero-carousel";
import { getProductImageUrl } from "@/lib/supabase/storage";
import type { getActiveProducts } from "@/lib/queries/shop";

type Product = Awaited<ReturnType<typeof getActiveProducts>>[number];

export async function HeroSection({ products }: { products: Product[] }) {
  const t = await getTranslations("shop");

  // Only products with a real photo can headline the hero — a placeholder
  // "Solelrim" tile would look broken blown up this large. `products` is
  // already ordered newest-first (getActiveProducts), so filtering keeps
  // that order — the 3 most recently added photographed products.
  const spotlight = products
    .filter((product) => product.images.length > 0)
    .slice(0, 3);

  if (spotlight.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-3xl bg-zinc-950 px-6 py-20 text-center sm:py-28">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[18vw] leading-none font-black whitespace-nowrap text-white/5 select-none"
        >
          SOLELRIM
        </span>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,var(--color-primary)/35,transparent_60%)]"
        />
        <div className="animate-in fade-in slide-in-from-bottom-6 relative flex flex-col items-center gap-5 duration-1000">
          <span className="rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-medium tracking-widest text-primary uppercase">
            {t("siteName")}
          </span>
          <h1 className="max-w-2xl text-4xl font-black tracking-tight text-balance text-white sm:text-6xl">
            {t("heroTitle")}
          </h1>
          <p className="max-w-md text-white/70 sm:text-lg">{t("heroSubtitle")}</p>
          <Button asChild size="lg" className="mt-2 h-12 px-8 text-base shadow-lg shadow-primary/30">
            <a href="#catalog">{t("heroCta")}</a>
          </Button>
        </div>
      </div>
    );
  }

  const slides = spotlight.map((product) => (
    <div key={product.id} className="grid md:min-h-110 md:grid-cols-2">
      <div className="flex flex-col justify-center gap-4 p-8 md:p-12 md:pb-20">
        <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          {product.category.name}
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl md:text-5xl">
          {product.name}
        </h1>
        {product.description && (
          <p className="max-w-sm text-sm text-muted-foreground sm:text-base">
            {product.description}
          </p>
        )}
        <div>
          <Button asChild size="lg" className="rounded-full px-8">
            <Link href={`/products/${product.id}`}>{t("heroShopProduct")}</Link>
          </Button>
        </div>
      </div>
      <div className="relative h-64 md:h-auto">
        <Image
          src={getProductImageUrl(product.images[0].storagePath)}
          alt={product.name}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
          priority
        />
      </div>
    </div>
  ));

  return (
    <div className="relative overflow-hidden rounded-3xl bg-muted">
      <HeroCarousel>{slides}</HeroCarousel>
    </div>
  );
}
