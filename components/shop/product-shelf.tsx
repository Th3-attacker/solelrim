import { ProductCard } from "@/components/shop/product-card";
import { ProductCarousel } from "@/components/shop/product-carousel";
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
      <div className="flex items-center gap-3">
        <span className="h-6 w-1.5 rounded-full bg-primary" />
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      </div>
      <ProductCarousel>
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </ProductCarousel>
    </div>
  );
}
