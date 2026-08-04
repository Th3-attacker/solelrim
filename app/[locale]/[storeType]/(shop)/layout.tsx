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
import { MobileNav } from "@/components/shop/mobile-nav";
import { SearchTrigger } from "@/components/shop/search-trigger";
import { Link } from "@/i18n/navigation";
import { getActiveProducts, getAllShopCategories } from "@/lib/queries/shop";
import { getPublicBoutiqueSettings } from "@/lib/queries/settings";
import { getPriceRange } from "@/lib/shop/price";
import { getProductImageUrl, getStoreLogoUrl } from "@/lib/supabase/storage";
import { DEFAULT_THEME_ID, getThemePreset } from "@/lib/theme/presets";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ storeType: string }>;
}): Promise<Metadata> {
  const { storeType } = await params;
  const [t, boutique] = await Promise.all([
    getTranslations("shop"),
    getPublicBoutiqueSettings(storeType),
  ]);
  const siteName = boutique.siteName?.trim() || t("siteName");
  return {
    title: boutique.seoTitle?.trim() || `${siteName} — ${t("heroTitle")}`,
    description: boutique.seoDescription?.trim() || t("heroSubtitle"),
  };
}

export default async function ShopLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ storeType: string }>;
}) {
  const { storeType } = await params;
  const [t, tNav, boutique] = await Promise.all([
    getTranslations("shop"),
    getTranslations("nav"),
    getPublicBoutiqueSettings(storeType),
  ]);
  const [allProducts, categories] = await Promise.all([
    getActiveProducts(storeType),
    getAllShopCategories(storeType),
  ]);

  const favoriteCandidates = allProducts.map((product) => ({
    id: product.id,
    slug: product.slug,
    name: product.name,
    imageUrl: product.images[0]
      ? getProductImageUrl(product.images[0].storagePath)
      : null,
    price: getPriceRange(product.variants, product.basePrice).min,
  }));

  const searchProducts = allProducts.map((product) => ({
    id: product.id,
    slug: product.slug,
    name: product.name,
  }));

  const siteName = boutique.siteName?.trim() || t("siteName");
  const logoUrl = boutique.logoStoragePath
    ? getStoreLogoUrl(boutique.logoStoragePath)
    : null;
  const announcementText = boutique.announcementText?.trim() || t("announcementBar");

  const socialLinks = boutique.socialLinks.map((link) => ({
    id: link.id,
    href: link.url,
    label: link.platform,
  }));

  const whatsappHref = boutique.adminWhatsappNumber
    ? `https://wa.me/${boutique.adminWhatsappNumber.replace(/\D/g, "")}`
    : null;

  const theme = getThemePreset(boutique.themeId);

  return (
    <FavoritesProvider storeType={storeType}>
      <CartProvider storeType={storeType}>
        <CheckoutDrawerProvider>
          {boutique.themeId !== DEFAULT_THEME_ID && (
            <style>{`
              .shop-theme { --primary: ${theme.light.primary}; --primary-foreground: ${theme.light.primaryForeground}; --ring: ${theme.light.ring}; }
              .dark .shop-theme { --primary: ${theme.dark.primary}; --primary-foreground: ${theme.dark.primaryForeground}; --ring: ${theme.dark.ring}; }
            `}</style>
          )}
          <div className="shop-theme flex min-h-screen flex-col">
            <div className="bg-primary py-2 text-center text-xs font-medium text-primary-foreground sm:text-sm">
              {announcementText}
            </div>
            <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-md">
              <div className="mx-auto grid h-16 max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-2 px-4 desktop:px-8">
                <div className="flex min-w-0 items-center gap-1">
                  <MobileNav categories={categories} products={searchProducts} />
                  <Link
                    href={`/${storeType}`}
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
                </div>
                <nav className="hidden items-center justify-center gap-6 md:flex">
                  <Link
                    href={`/${storeType}`}
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {tNav("home")}
                  </Link>
                  <Link
                    href={`/${storeType}/products`}
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {tNav("products")}
                  </Link>
                  <Link
                    href={`/${storeType}/about`}
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t("aboutLink")}
                  </Link>
                  <Link
                    href={`/${storeType}/contact`}
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t("contactLink")}
                  </Link>
                </nav>
                <div className="flex items-center justify-end gap-1">
                  <div className="hidden md:block">
                    <SearchTrigger categories={categories} products={searchProducts} />
                  </div>
                  <FavoritesTrigger products={favoriteCandidates} />
                  <CartTrigger />
                  <div className="hidden md:block">
                    <LanguageSwitcher />
                  </div>
                  <ModeToggle />
                </div>
              </div>
            </header>
            <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 desktop:px-8 md:py-10">
              {children}
            </main>
            <footer className="border-t bg-zinc-950 text-zinc-400">
              <div className="mx-auto max-w-7xl px-4 py-12 desktop:px-8">
                <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4">
                  <div className="col-span-2 flex flex-col gap-3 sm:col-span-1">
                    <Link
                      href={`/${storeType}`}
                      className="flex items-center gap-2 text-base font-bold text-white"
                    >
                      {logoUrl && (
                        <Image
                          src={logoUrl}
                          alt=""
                          width={28}
                          height={28}
                          className="size-7 shrink-0 object-contain"
                        />
                      )}
                      {siteName}
                    </Link>
                    <p className="max-w-52 text-sm text-zinc-500">{t("heroSubtitle")}</p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <h3 className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
                      {t("footerShopTitle")}
                    </h3>
                    <nav className="flex flex-col gap-2 text-sm">
                      <Link href={`/${storeType}/products`} className="transition-colors hover:text-white">
                        {t("allProductsTitle")}
                      </Link>
                      {categories.map((category) => (
                        <Link
                          key={category.id}
                          href={{
                            pathname: `/${storeType}/products`,
                            query: { category: category.id },
                          }}
                          className="transition-colors hover:text-white"
                        >
                          {category.name}
                        </Link>
                      ))}
                    </nav>
                  </div>

                  <div className="flex flex-col gap-3">
                    <h3 className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
                      {t("footerHelpTitle")}
                    </h3>
                    <nav className="flex flex-col gap-2 text-sm">
                      <Link href={`/${storeType}/about`} className="transition-colors hover:text-white">
                        {t("aboutLink")}
                      </Link>
                      <Link href={`/${storeType}/contact`} className="transition-colors hover:text-white">
                        {t("contactLink")}
                      </Link>
                      {whatsappHref && (
                        <a
                          href={whatsappHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 transition-colors hover:text-white"
                        >
                          <MessageCircle className="size-4" />
                          {t("contactWhatsapp")}
                        </a>
                      )}
                    </nav>
                  </div>

                  {socialLinks.length > 0 && (
                    <div className="flex flex-col gap-3">
                      <h3 className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
                        {t("footerFollowTitle")}
                      </h3>
                      <nav className="flex flex-col gap-2 text-sm">
                        {socialLinks.map((social) => (
                          <a
                            key={social.id}
                            href={social.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="transition-colors hover:text-white"
                          >
                            {social.label}
                          </a>
                        ))}
                      </nav>
                    </div>
                  )}
                </div>

                <div className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-zinc-500">
                  © {new Date().getFullYear()} {siteName}
                </div>
              </div>
            </footer>
          </div>
          <CheckoutDrawer
            settings={{
              bankilyNumber: boutique.bankilyNumber,
              masrivyNumber: boutique.masrivyNumber,
              adminWhatsappNumber: boutique.adminWhatsappNumber,
              paymentInstructions: boutique.paymentInstructions,
            }}
          />
        </CheckoutDrawerProvider>
      </CartProvider>
    </FavoritesProvider>
  );
}
