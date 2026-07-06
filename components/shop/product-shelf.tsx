import { ProductCard } from "@/components/shop/product-card";
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
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
