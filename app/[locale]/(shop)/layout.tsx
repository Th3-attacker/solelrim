import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ModeToggle } from "@/components/mode-toggle";
import { CartProvider } from "@/components/cart/cart-provider";
import { CartTrigger } from "@/components/cart/cart-trigger";
import { FavoritesProvider } from "@/components/shop/favorites-provider";
import { FavoritesTrigger } from "@/components/shop/favorites-trigger";
import { SearchTrigger } from "@/components/shop/search-trigger";
import { Link } from "@/i18n/navigation";
import { getActiveProducts } from "@/lib/queries/shop";
import { getPriceRange } from "@/lib/shop/price";
import { getProductImageUrl } from "@/lib/supabase/storage";

export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [t, allProducts] = await Promise.all([
    getTranslations("shop"),
    getActiveProducts(),
  ]);

  const favoriteCandidates = allProducts.map((product) => ({
    id: product.id,
    name: product.name,
    imageUrl: product.images[0]
      ? getProductImageUrl(product.images[0].storagePath)
      : null,
    price: getPriceRange(product.variants, product.basePrice).min,
  }));

  return (
    <FavoritesProvider>
      <CartProvider>
        <div className="shop-theme flex min-h-screen flex-col">
          <div className="bg-primary py-2 text-center text-xs font-medium text-primary-foreground sm:text-sm">
            {t("announcementBar")}
          </div>
          <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-md">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
              <Link
                href="/"
                className="text-lg font-bold tracking-tight text-foreground"
              >
                Sol<span className="text-primary">elrim</span>
              </Link>
              <div className="flex items-center gap-1">
                <SearchTrigger />
                <FavoritesTrigger products={favoriteCandidates} />
                <CartTrigger />
                <LanguageSwitcher />
                <ModeToggle />
              </div>
            </div>
          </header>
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 md:py-10">
            {children}
          </main>
          <footer className="border-t bg-muted/30">
            <div className="mx-auto max-w-7xl px-4 py-8 text-center text-sm text-muted-foreground sm:px-6">
              © {new Date().getFullYear()} Solelrim
            </div>
          </footer>
        </div>
      </CartProvider>
    </FavoritesProvider>
  );
}
