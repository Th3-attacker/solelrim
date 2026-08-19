import type { Metadata } from "next";
import Image from "next/image";
import { ChatCircle } from "@phosphor-icons/react/dist/ssr";
import { getLocale, getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ModeToggle } from "@/components/mode-toggle";
import { CartProvider } from "@/components/cart/cart-provider";
import { CartTrigger } from "@/components/cart/cart-trigger";
import { FavoritesProvider } from "@/components/shop/favorites-provider";
import { FavoritesTrigger } from "@/components/shop/favorites-trigger";
import { MobileNav } from "@/components/shop/mobile-nav";
import { PwaInstallPrompt } from "@/components/shop/pwa-install-prompt";
import { SearchTrigger } from "@/components/shop/search-trigger";
import { ExpiredStorefront } from "@/components/shop/expired-storefront";
import { Link } from "@/i18n/navigation";
import { getActiveProducts, getAllShopCategories } from "@/lib/queries/shop";
import { getPublicBoutiqueSettings } from "@/lib/queries/settings";
import { getPriceRange } from "@/lib/shop/price";
import { getStorefrontBasePath } from "@/lib/shop/storefront-path";
import { getLicenseStatus } from "@/lib/shop/license";
import { resolveBoutiqueText } from "@/lib/shop/localized-boutique-text";
import { getProductImageUrl, getStoreLogoUrl } from "@/lib/supabase/storage";
import { DEFAULT_THEME_ID, resolveStoreTheme } from "@/lib/theme/presets";
import { buildSocialMetadata, buildStoreUrl, jsonLdScriptProps } from "@/lib/shop/metadata";

// Meta keywords have had no effect on Google ranking since 2009 — this
// exists only because a couple of smaller engines/directories still read
// it, and it's free once the copy above already exists. Sourced from the
// real catalog (not hand-maintained) so it can't go stale like the old
// hardcoded brand text did.
const COUNTRY_NAME: Record<string, string> = {
  fr: "Mauritanie",
  en: "Mauritania",
  ar: "موريتانيا",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ storeType: string }>;
}): Promise<Metadata> {
  const { storeType } = await params;
  const [t, locale, boutique, categories] = await Promise.all([
    getTranslations("shop"),
    getLocale(),
    getPublicBoutiqueSettings(storeType),
    getAllShopCategories(storeType),
  ]);
  const localized = resolveBoutiqueText(boutique, locale);
  const siteName = localized.siteName?.trim() || t("siteName");
  const title = localized.seoTitle?.trim() || `${siteName} — ${t("heroTitle")}`;
  const description = localized.seoDescription?.trim() || t("heroSubtitle");
  const imageUrl = boutique.logoStoragePath
    ? getStoreLogoUrl(boutique.logoStoragePath)
    : null;
  const keywords = [
    ...new Set([
      siteName,
      ...categories.map((category) => category.name),
      COUNTRY_NAME[locale] ?? COUNTRY_NAME.fr,
    ]),
  ];

  return {
    title,
    description,
    keywords,
    ...buildSocialMetadata({
      title,
      description,
      imageUrl,
      locale,
      domain: boutique.domain,
      storeKey: storeType,
      path: "",
    }),
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
  const [t, tNav, boutique, basePath, locale] = await Promise.all([
    getTranslations("shop"),
    getTranslations("nav"),
    getPublicBoutiqueSettings(storeType),
    getStorefrontBasePath(storeType),
    getLocale(),
  ]);

  if (getLicenseStatus(boutique.licenseExpiresAt) === "expired") {
    return (
      <ExpiredStorefront
        siteName={resolveBoutiqueText(boutique, locale).siteName?.trim() || t("siteName")}
        logoUrl={boutique.logoStoragePath ? getStoreLogoUrl(boutique.logoStoragePath) : null}
      />
    );
  }

  const [allProducts, categories] = await Promise.all([
    getActiveProducts(storeType),
    getAllShopCategories(storeType),
  ]);

  // Also used for search suggestions (thumbnail + price), not just favorites.
  const favoriteCandidates = allProducts.map((product) => ({
    id: product.id,
    slug: product.slug,
    name: product.name,
    imageUrl: product.images[0]
      ? getProductImageUrl(product.images[0].storagePath)
      : null,
    price: getPriceRange(product.variants, product.basePrice).min,
  }));

  const siteName = resolveBoutiqueText(boutique, locale).siteName?.trim() || t("siteName");
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

  const theme = resolveStoreTheme(boutique);
  const forcedColorMode = boutique.colorMode === "light" || boutique.colorMode === "dark"
    ? boutique.colorMode
    : undefined;

  const canonicalUrl = buildStoreUrl({ domain: boutique.domain, storeKey: storeType, path: "", locale });
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteName,
    url: canonicalUrl,
    ...(logoUrl ? { logo: logoUrl } : {}),
    ...(socialLinks.length > 0 ? { sameAs: socialLinks.map((link) => link.href) } : {}),
  };
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteName,
    url: canonicalUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: `${canonicalUrl}/products?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <FavoritesProvider storeType={storeType}>
      <CartProvider storeType={storeType}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLdScriptProps([organizationJsonLd, websiteJsonLd])}
        />
          {boutique.themeId !== DEFAULT_THEME_ID && (
            <style>{`
              .shop-theme { --primary: ${theme.light.primary}; --primary-foreground: ${theme.light.primaryForeground}; --ring: ${theme.light.ring}; }
              .dark .shop-theme { --primary: ${theme.dark.primary}; --primary-foreground: ${theme.dark.primaryForeground}; --ring: ${theme.dark.ring}; }
            `}</style>
          )}
          {forcedColorMode && (
            // The root ThemeProvider (app/[locale]/layout.tsx) is shared with
            // the admin dashboard, so it can't be locked per-boutique — this
            // runs right after its own anti-flash script and overrides both
            // the live <html> class and the stored preference it reads next,
            // so a returning visitor's opposite preference can't win and
            // React's own hydration doesn't fight this back afterward.
            <script
              dangerouslySetInnerHTML={{
                __html: `(function(){try{var m=${JSON.stringify(forcedColorMode)};localStorage.setItem("theme",m);var c=document.documentElement.classList;c.remove("light","dark");c.add(m);document.documentElement.style.colorScheme=m;}catch(e){}})();`,
              }}
            />
          )}
          <div className="shop-theme flex min-h-screen flex-col">
            <div className="bg-primary py-2 text-center text-xs font-medium text-primary-foreground sm:text-sm">
              {announcementText}
            </div>
            <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-md">
              <div className="mx-auto grid h-16 max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-2 px-4 desktop:px-8">
                <div className="flex min-w-0 items-center gap-1">
                  <MobileNav categories={categories} products={favoriteCandidates} basePath={basePath} />
                  <Link
                    href={basePath || "/"}
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
                    href={basePath || "/"}
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {tNav("home")}
                  </Link>
                  <Link
                    href={`${basePath}/products`}
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {tNav("products")}
                  </Link>
                  <Link
                    href={`${basePath}/about`}
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t("aboutLink")}
                  </Link>
                  <Link
                    href={`${basePath}/contact`}
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t("contactLink")}
                  </Link>
                  <Link
                    href={`${basePath}/track-order`}
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t("trackOrderLink")}
                  </Link>
                </nav>
                <div className="flex items-center justify-end gap-1">
                  <div className="hidden md:block">
                    <SearchTrigger categories={categories} products={favoriteCandidates} basePath={basePath} />
                  </div>
                  <FavoritesTrigger products={favoriteCandidates} basePath={basePath} />
                  <CartTrigger basePath={basePath} />
                  <div className="hidden md:block">
                    <LanguageSwitcher />
                  </div>
                  {boutique.colorMode === "auto" && <ModeToggle />}
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
                      href={basePath || "/"}
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
                      <Link href={`${basePath}/products`} className="transition-colors hover:text-white">
                        {t("allProductsTitle")}
                      </Link>
                      {categories.map((category) => (
                        <Link
                          key={category.id}
                          href={{
                            pathname: `${basePath}/products`,
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
                      <Link href={`${basePath}/about`} className="transition-colors hover:text-white">
                        {t("aboutLink")}
                      </Link>
                      <Link href={`${basePath}/contact`} className="transition-colors hover:text-white">
                        {t("contactLink")}
                      </Link>
                      <Link href={`${basePath}/legal`} className="transition-colors hover:text-white">
                        {t("legalLink")}
                      </Link>
                      <Link
                        href={`${basePath}/track-order`}
                        className="transition-colors hover:text-white"
                      >
                        {t("trackOrderLink")}
                      </Link>
                      {whatsappHref && (
                        <a
                          href={whatsappHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 transition-colors hover:text-white"
                        >
                          <ChatCircle className="size-4" />
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
          <PwaInstallPrompt siteName={siteName} />
      </CartProvider>
    </FavoritesProvider>
  );
}
