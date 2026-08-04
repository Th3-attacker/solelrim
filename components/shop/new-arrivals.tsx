import { ProductCard } from "@/components/shop/product-card";
import { Reveal } from "@/components/shop/reveal";
import { SectionTitle } from "@/components/shop/section-title";
import type { getActiveProducts } from "@/lib/queries/shop";
import { getTranslations } from "next-intl/server";

type Product = Awaited<ReturnType<typeof getActiveProducts>>[number];

export async function NewArrivals({
  products,
  storeType,
}: {
  products: Product[];
  storeType: string;
}) {
  if (products.length === 0) return null;
  const t = await getTranslations("shop");

  return (
    <div className="flex flex-col items-center gap-6">
      <SectionTitle>{t("newArrivalsTitle")}</SectionTitle>
      <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4 desktop:gap-4">
        {products.map((product, index) => (
          <Reveal key={product.id} delay={index * 80}>
            <ProductCard product={product} storeType={storeType} />
          </Reveal>
        ))}
      </div>
    </div>
  );
}
