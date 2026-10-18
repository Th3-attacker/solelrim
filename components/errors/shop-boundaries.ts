import { ShopError } from "@/components/errors/shop-error";
import { ShopHomeSkeleton } from "@/components/shop/page-skeletons";

// Les frontières des pages de la boutique (ex-error.tsx et loading.tsx du
// groupe (shop)) : l'erreur ou le squelette s'affichent à la place de la
// page, dans le cadre de la boutique.
export const shopPageBoundaries = {
  errorComponent: ShopError,
  pendingComponent: ShopHomeSkeleton,
} as const;
