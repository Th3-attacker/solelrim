import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  getActiveProductBySlug,
  getActiveProducts,
  getAdjacentProductSlugs,
  getProductSlugById,
} from "@/lib/queries/shop";
import { getPublicBoutiqueSettings } from "@/lib/queries/settings";
import { getProductImageUrl } from "@/lib/supabase/storage";
import { getVariantPrice } from "@/lib/shop/price";
import { isNewProduct } from "@/lib/shop/badges";
import { buildSocialMetadata, buildStoreUrl, jsonLdScriptProps } from "@/lib/shop/metadata";
import { getStorefrontBasePath } from "@/lib/shop/storefront-path";
import { resolveBoutiqueText } from "@/lib/shop/localized-boutique-text";
import { ProductDetailView } from "@/components/shop/product-detail-view";
import { ProductCard } from "@/components/shop/product-card";
import { Button } from "@/components/ui/button";
import { Link, redirect } from "@/i18n/navigation";

const RELATED_PRODUCTS_LIMIT = 4;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ storeType: string; productSlug: string }>;
}): Promise<Metadata> {
  const { storeType, productSlug } = await params;
  const [tShop, locale, boutique, product] = await Promise.all([
    getTranslations("shop"),
    getLocale(),
    getPublicBoutiqueSettings(storeType),
    getActiveProductBySlug(productSlug, storeType),
  ]);

  if (!product) {
    return {};
  }

  const siteName = resolveBoutiqueText(boutique, locale).siteName?.trim() || tShop("siteName");
  const title = `${product.name} — ${siteName}`;
  const description = product.description?.trim() || tShop("heroSubtitle");
  const imageUrl = product.images[0]
    ? getProductImageUrl(product.images[0].storagePath)
    : null;
  const keywords = [
    ...new Set([
      product.name,
      product.category.name,
      siteName,
      ...product.variants.map((v) => v.color).filter((color): color is string => !!color),
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
      path: `/products/${productSlug}`,
    }),
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ storeType: string; productSlug: string }>;
}) {
  const { storeType, productSlug } = await params;
  const [t, basePath, locale, boutique] = await Promise.all([
    getTranslations("shop"),
    getStorefrontBasePath(storeType),
    getLocale(),
    getPublicBoutiqueSettings(storeType),
  ]);
  const productType = storeType;
  const product = await getActiveProductBySlug(productSlug, productType);

  if (!product) {
    // Pre-slug links shared as the raw cuid still land here — redirect to
    // the canonical slug URL instead of a dead end.
    const legacy = await getProductSlugById(productSlug, productType);
    if (legacy) {
      redirect({ href: `${basePath}/products/${legacy.slug}`, locale });
    }
    notFound();
  }

  const { prevSlug, nextSlug } = await getAdjacentProductSlugs(
    product.categoryId,
    product.id,
    productType,
  );
  const relatedProducts = await getActiveProducts(productType, product.categoryId, {
    excludeId: product.id,
    take: RELATED_PRODUCTS_LIMIT,
  });

  const images = product.images.map((image) => ({
    id: image.id,
    url: getProductImageUrl(image.storagePath),
    storagePath: image.storagePath,
    color: image.color,
  }));
  const variants = product.variants.map((variant) => ({
    id: variant.id,
    size: variant.size,
    color: variant.color,
    stock: variant.stock,
    lowStockThreshold: variant.lowStockThreshold,
    price: getVariantPrice(variant, product.basePrice),
  }));

  const siteName = resolveBoutiqueText(boutique, locale).siteName?.trim() || t("siteName");
  const canonicalUrl = buildStoreUrl({
    domain: boutique.domain,
    storeKey: storeType,
    path: `/products/${productSlug}`,
    locale,
  });
  const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);
  const startingPrice = variants.length > 0
    ? Math.min(...variants.map((v) => v.price))
    : product.basePrice.toNumber();
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description?.trim() || t("heroSubtitle"),
    image: images.map((image) => image.url),
    category: product.category.name,
    brand: { "@type": "Brand", name: siteName },
    offers: {
      "@type": "Offer",
      price: startingPrice,
      priceCurrency: "MRU",
      availability: totalStock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: canonicalUrl,
    },
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: siteName,
        item: buildStoreUrl({ domain: boutique.domain, storeKey: storeType, path: "", locale }),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: product.category.name,
        item: buildStoreUrl({ domain: boutique.domain, storeKey: storeType, path: "/products", locale }),
      },
      { "@type": "ListItem", position: 3, name: product.name, item: canonicalUrl },
    ],
  };

  return (
    <div className="flex flex-col gap-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScriptProps([productJsonLd, breadcrumbJsonLd])}
      />
      <nav className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
          <Link href={basePath || "/"} className="hover:text-foreground">
            {t("siteName")}
          </Link>
          <span aria-hidden>/</span>
          <Link
            href={{
              pathname: `${basePath}/products`,
              query: { category: product.categoryId },
            }}
            className="hover:text-foreground"
          >
            {product.category.name}
          </Link>
          <span aria-hidden>/</span>
          <span className="text-foreground">{product.name}</span>
        </div>

        <div className="flex items-center gap-1">
          {prevSlug ? (
            <Button asChild variant="outline" size="icon-sm">
              <Link
                href={`${basePath}/products/${prevSlug}`}
                aria-label={t("previousProduct")}
              >
                <ChevronLeft className="rtl:rotate-180" />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="icon-sm" disabled>
              <ChevronLeft className="rtl:rotate-180" />
            </Button>
          )}
          {nextSlug ? (
            <Button asChild variant="outline" size="icon-sm">
              <Link
                href={`${basePath}/products/${nextSlug}`}
                aria-label={t("nextProduct")}
              >
                <ChevronRight className="rtl:rotate-180" />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="icon-sm" disabled>
              <ChevronRight className="rtl:rotate-180" />
            </Button>
          )}
        </div>
      </nav>

      <ProductDetailView
        // Remounts on navigation between products (prev/next arrows,
        // related-products grid) — otherwise selectedSize/selectedColor/
        // selectedImageIndex state from the previous product carries over.
        key={product.id}
        productId={product.id}
        productName={product.name}
        productType={productType}
        description={product.description}
        basePrice={product.basePrice.toNumber()}
        compareAtPrice={product.compareAtPrice?.toNumber() ?? null}
        isNew={isNewProduct(product.createdAt)}
        isFeatured={product.isFeatured}
        images={images}
        variants={variants}
      />

      {relatedProducts.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-heading-xs">{t("relatedProducts")}</h2>
          <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 desktop:grid-cols-4 desktop:gap-4">
            {relatedProducts.map((related) => (
              <ProductCard
                key={related.id}
                product={related}
                basePath={basePath}
                cardVariant={boutique.cardVariant}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
