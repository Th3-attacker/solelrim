import { ProductCard } from "@/components/shop/product-card";
import { ProductCarousel } from "@/components/shop/product-carousel";
import { SectionTitle } from "@/components/shop/section-title";
import type { getActiveProducts } from "@/lib/queries/shop";

type Product = Awaited<ReturnType<typeof getActiveProducts>>[number];

export function ProductShelf({
  title,
  products,
}: {
  title: string;
  products: Product[];
}) {
  if (products.length === 0) return null;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 flex flex-col gap-4 duration-700">
      <SectionTitle>{title}</SectionTitle>
      <ProductCarousel>
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </ProductCarousel>
    </div>
  );
}
