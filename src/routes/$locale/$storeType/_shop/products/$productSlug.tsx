import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { shopPageBoundaries } from "@/components/errors/shop-boundaries";
import { ProductCard } from "@/components/shop/product-card";
import { ProductDetailView } from "@/components/shop/product-detail-view";
import { ProductDetailSkeleton } from "@/components/shop/page-skeletons";
import { Button } from "@/components/ui/button";
import { Link, redirect } from "@/i18n/navigation";
import { optimizedImagePath } from "@/lib/image-config";
import {
  getActiveProductBySlug,
  getActiveProducts,
  getAdjacentProductSlugs,
  getProductSlugById,
} from "@/lib/queries/shop";
import { resolveMetadata } from "@/lib/seo/head";
import { isNewProduct } from "@/lib/shop/badges";
import { buildStoreUrl, jsonLdScriptProps } from "@/lib/shop/metadata";
import { getVariantPrice } from "@/lib/shop/price";
import { getProductImageUrl } from "@/lib/supabase/storage";
import { getShopPageContext, shopPageMetadata } from "@/src/server/shop";
import { stringFields } from "@/src/server/validators";

// Ex-app/[locale]/[storeType]/(shop)/products/[productSlug]/page.tsx.

const RELATED_PRODUCTS_LIMIT = 4;

// Repli de description SEO pour un produit sans description réelle : plutôt
// que de retomber sur le sous-titre générique de la vitrine (ce qui donnerait
// à toutes les fiches sans description la même meta description — signal de
// contenu mince pour Google), on compose une phrase unique à partir des données
// réelles du produit (nom + catégorie + boutique). Jamais de caractéristique
// inventée : on ne répète que ce qui existe déjà en base.
function seoDescriptionFor(
  product: { name: string; description: string | null; category: { name: string } },
  siteName: string,
  genericFallback: string,
): string {
  return (
    product.description?.trim() ||
    `${product.name} — ${product.category.name} · ${siteName}`.trim() ||
    genericFallback
  );
}

const loadProduct = createServerFn({ method: "GET" })
  .validator(stringFields("storeType", "productSlug"))
  .handler(async ({ data: { storeType, productSlug } }) => {
    const context = await getShopPageContext(storeType);
    const { tShop: t, basePath, locale, boutique, siteName } = context;
    const productType = storeType;
    const product = await getActiveProductBySlug(productSlug, productType);

    if (!product) {
      // Pre-slug links shared as the raw cuid still land here — redirect to
      // the canonical slug URL instead of a dead end.
      const legacy = await getProductSlugById(productSlug, productType);
      if (legacy) {
        redirect({ href: `${basePath}/products/${legacy.slug}`, locale });
      }
      throw notFound();
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

    // Through the image optimizer, not the original: WhatsApp and the other
    // link previews fetch og:image on every share, and an original can weigh
    // a few MB (each fetch counts against Supabase's egress).
    const imageUrl = product.images[0]
      ? optimizedImagePath(getProductImageUrl(product.images[0].storagePath), 1200)
      : null;
    const keywords = [
      ...new Set([
        product.name,
        product.category.name,
        siteName,
        ...product.variants.map((v) => v.color).filter((color): color is string => !!color),
      ]),
    ];
    const meta = resolveMetadata(
      shopPageMetadata(context, {
        storeType,
        path: `/products/${productSlug}`,
        title: `${product.name} — ${siteName}`,
        description: seoDescriptionFor(product, siteName, t("heroSubtitle")),
        keywords,
        imageUrl,
      }),
    );

    const canonicalUrl = buildStoreUrl({
      domain: boutique.domain,
      storeKey: storeType,
      path: `/products/${productSlug}`,
      locale,
    });
    const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);
    const startingPrice =
      variants.length > 0
        ? Math.min(...variants.map((v) => v.price))
        : product.basePrice.toNumber();
    // Un an à partir de maintenant : Google recommande un priceValidUntil
    // limité dans le futur pour les offres ; le prix étant revu régulièrement
    // côté admin, une date lointaine laisserait mentir la page après un changement.
    const priceValidUntil = new Date();
    priceValidUntil.setFullYear(priceValidUntil.getFullYear() + 1);

    const productJsonLd = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      // Aligné sur la meta description (même repli) pour éviter qu'un produit
      // sans description porte deux textes différents dans la même page.
      description: seoDescriptionFor(product, siteName, t("heroSubtitle")),
      image: images.map((image) =>
        new URL(optimizedImagePath(image.url, 1200), canonicalUrl).toString(),
      ),
      // L'identifiant public du produit est son slug d'URL — unique en base —
      // utilisé comme sku : Google le recommande comme identifiant marchand
      // quand aucun code-barres (gtin) n'existe.
      sku: productSlug,
      category: product.category.name,
      brand: { "@type": "Brand", name: siteName },
      offers: {
        "@type": "Offer",
        price: startingPrice,
        priceCurrency: "MRU",
        availability:
          totalStock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        url: canonicalUrl,
        // Produits toujours neufs en boutique — aucune occasion revendue.
        itemCondition: "https://schema.org/NewCondition",
        priceValidUntil: priceValidUntil.toISOString().slice(0, 10),
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
          item: buildStoreUrl({
            domain: boutique.domain,
            storeKey: storeType,
            path: "/products",
            locale,
          }),
        },
        { "@type": "ListItem", position: 3, name: product.name, item: canonicalUrl },
      ],
    };

    return {
      meta,
      jsonLd: [productJsonLd, breadcrumbJsonLd],
      basePath,
      cardVariant: boutique.cardVariant,
      prevSlug,
      nextSlug,
      relatedProducts,
      images,
      variants,
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        categoryId: product.categoryId,
        categoryName: product.category.name,
        basePrice: product.basePrice.toNumber(),
        compareAtPrice: product.compareAtPrice?.toNumber() ?? null,
        isNew: isNewProduct(product.createdAt),
        isFeatured: product.isFeatured,
      },
    };
  });

export const Route = createFileRoute("/$locale/$storeType/_shop/products/$productSlug")({
  loader: ({ params }) =>
    loadProduct({ data: { storeType: params.storeType, productSlug: params.productSlug } }),
  component: ProductDetailPage,
  ...shopPageBoundaries,
  pendingComponent: ProductDetailSkeleton,
});

function ProductDetailPage() {
  const { storeType } = Route.useParams();
  const {
    jsonLd,
    basePath,
    cardVariant,
    prevSlug,
    nextSlug,
    relatedProducts,
    images,
    variants,
    product,
  } = Route.useLoaderData();
  const t = useTranslations("shop");

  return (
    <div className="flex flex-col gap-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScriptProps(jsonLd)} />
      <nav
        aria-label={t("breadcrumbLabel")}
        className="flex flex-wrap items-center justify-between gap-2 text-sm"
      >
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
            {product.categoryName}
          </Link>
          <span aria-hidden>/</span>
          <span className="text-foreground">{product.name}</span>
        </div>

        <div className="flex items-center gap-1">
          {prevSlug ? (
            <Button asChild variant="outline" size="icon-sm">
              <Link href={`${basePath}/products/${prevSlug}`} aria-label={t("previousProduct")}>
                <CaretLeft className="rtl:rotate-180" />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="icon-sm" disabled>
              <CaretLeft className="rtl:rotate-180" />
            </Button>
          )}
          {nextSlug ? (
            <Button asChild variant="outline" size="icon-sm">
              <Link href={`${basePath}/products/${nextSlug}`} aria-label={t("nextProduct")}>
                <CaretRight className="rtl:rotate-180" />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="icon-sm" disabled>
              <CaretRight className="rtl:rotate-180" />
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
        productType={storeType}
        description={product.description}
        basePrice={product.basePrice}
        compareAtPrice={product.compareAtPrice}
        isNew={product.isNew}
        isFeatured={product.isFeatured}
        images={images}
        variants={variants}
      />

      {relatedProducts.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-heading-xs">{t("relatedProducts")}</h2>
          <ul
            role="list"
            className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 desktop:grid-cols-4 desktop:gap-4"
          >
            {relatedProducts.map((related) => (
              <li key={related.id}>
                <ProductCard product={related} basePath={basePath} cardVariant={cardVariant} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
