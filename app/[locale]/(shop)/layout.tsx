import type { Metadata } from "next";
import Image from "next/image";
import { MessageCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ModeToggle } from "@/components/mode-toggle";
import { CartProvider } from "@/components/cart/cart-provider";
import { CartTrigger } from "@/components/cart/cart-trigger";
import { CheckoutDrawerProvider } from "@/components/checkout/checkout-drawer-provider";
import { CheckoutDrawer } from "@/components/checkout/checkout-drawer";
import { FavoritesProvider } from "@/components/shop/favorites-provider";
import { FavoritesTrigger } from "@/components/shop/favorites-trigger";
import { SearchTrigger } from "@/components/shop/search-trigger";
import { Link } from "@/i18n/navigation";
import { getActiveProducts, getAllShopCategories } from "@/lib/queries/shop";
import { getStoreSettings } from "@/lib/queries/settings";
import { getPriceRange } from "@/lib/shop/price";
import { getProductImageUrl, getStoreLogoUrl } from "@/lib/supabase/storage";

export async function generateMetadata(): Promise<Metadata> {
  const [t, settings] = await Promise.all([
    getTranslations("shop"),
    getStoreSettings(),
  ]);
  const siteName = settings.siteName?.trim() || t("siteName");
  return {
    title: settings.seoTitle?.trim() || `${siteName} — ${t("heroTitle")}`,
    description: settings.seoDescription?.trim() || t("heroSubtitle"),
  };
}

export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [t, allProducts, categories, settings] = await Promise.all([
    getTranslations("shop"),
    getActiveProducts(),
    getAllShopCategories(),
    getStoreSettings(),
  ]);

  const favoriteCandidates = allProducts.map((product) => ({
    id: product.id,
    name: product.name,
    imageUrl: product.images[0]
      ? getProductImageUrl(product.images[0].storagePath)
      : null,
    price: getPriceRange(product.variants, product.basePrice).min,
  }));

  const searchProducts = allProducts.map((product) => ({
    id: product.id,
    name: product.name,
  }));

  const siteName = settings.siteName?.trim() || t("siteName");
  const logoUrl = settings.logoStoragePath
    ? getStoreLogoUrl(settings.logoStoragePath)
    : null;
  const announcementText = settings.announcementText?.trim() || t("announcementBar");

  const socialLinks = [
    { href: settings.instagramUrl?.trim(), label: "Instagram" },
    { href: settings.facebookUrl?.trim(), label: "Facebook" },
    { href: settings.tiktokUrl?.trim(), label: "TikTok" },
  ].filter((social): social is { href: string; label: string } =>
    Boolean(social.href),
  );

  const whatsappHref = settings.adminWhatsappNumber
    ? `https://wa.me/${settings.adminWhatsappNumber.replace(/\D/g, "")}`
    : null;

  return (
    <FavoritesProvider>
      <CartProvider>
        <CheckoutDrawerProvider>
          <div className="shop-theme flex min-h-screen flex-col">
            <div className="bg-primary py-2 text-center text-xs font-medium text-primary-foreground sm:text-sm">
              {announcementText}
            </div>
            <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-md">
              <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
                <Link
                  href="/"
                  className="flex min-w-0 shrink items-center gap-2 truncate text-base font-bold tracking-tight whitespace-nowrap text-foreground sm:text-lg"
                >
                  {logoUrl && (
                    <Image
                      src={logoUrl}
                      alt=""
                      width={32}
                      height={32}
                      className="size-8 shrink-0 object-contain"
                    />
                  )}
                  {siteName}
                </Link>
                <div className="flex items-center gap-1">
                  <SearchTrigger categories={categories} products={searchProducts} />
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
              <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 py-8 text-center text-sm text-muted-foreground sm:px-6">
                <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
                  <Link href="/about" className="transition-colors hover:text-foreground">
                    {t("aboutLink")}
                  </Link>
                  {whatsappHref && (
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 transition-colors hover:text-foreground"
                    >
                      <MessageCircle className="size-4" />
                      {t("contactWhatsapp")}
                    </a>
                  )}
                  {socialLinks.map((social) => (
                    <a
                      key={social.label}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition-colors hover:text-foreground"
                    >
                      {social.label}
                    </a>
                  ))}
                </div>
                <span>
                  © {new Date().getFullYear()} {siteName}
                </span>
              </div>
            </footer>
          </div>
          <CheckoutDrawer settings={settings} />
        </CheckoutDrawerProvider>
      </CartProvider>
    </FavoritesProvider>
  );
}
