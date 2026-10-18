import "server-only";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { getPublicBoutiqueSettings } from "@/lib/queries/settings";
import { getStorefrontBasePath } from "@/lib/services/storefront-path";
import { resolveBoutiqueText } from "@/lib/shop/localized-boutique-text";
import { buildSocialMetadata } from "@/lib/shop/metadata";
import { getStoreLogoUrl } from "@/lib/supabase/storage";

// Ce que presque chaque page de vitrine recalculait dans son
// generateMetadata : la boutique, son nom dans la langue courante et son
// logo pour l'aperçu des liens partagés.
export async function getShopPageContext(storeType: string) {
  const [tShop, locale, boutique, basePath] = await Promise.all([
    getTranslations("shop"),
    getLocale(),
    getPublicBoutiqueSettings(storeType),
    getStorefrontBasePath(storeType),
  ]);
  const siteName = resolveBoutiqueText(boutique, locale).siteName?.trim() || tShop("siteName");
  const imageUrl = boutique.logoStoragePath ? getStoreLogoUrl(boutique.logoStoragePath) : null;
  return { tShop, locale, boutique, basePath, siteName, imageUrl };
}

type ShopPageContext = Awaited<ReturnType<typeof getShopPageContext>>;

// Titre, description et aperçu de partage (Open Graph, canonique, hreflang)
// d'une page publique de la boutique.
export function shopPageMetadata(
  context: ShopPageContext,
  {
    storeType,
    path,
    title,
    description,
    keywords,
    imageUrl = context.imageUrl,
  }: {
    storeType: string;
    path: string;
    title: string;
    description: string;
    keywords?: string[];
    imageUrl?: string | null;
  },
): Metadata {
  return {
    title,
    description,
    ...(keywords && { keywords }),
    ...buildSocialMetadata({
      title,
      description,
      imageUrl,
      locale: context.locale,
      domain: context.boutique.domain,
      storeKey: storeType,
      path,
      siteName: context.siteName,
    }),
  };
}
