import { createMiddleware } from "@tanstack/react-start";
import { LOCALE_HEADER } from "@/src/middleware/locale";

// Chaque appel de server function depuis le navigateur porte la langue de la
// page en cours de chargement : les traductions côté serveur
// (getTranslations) la suivent ainsi, comme avec next-intl — y compris
// pendant un changement de langue, où l'URL visée (latestLocation) a déjà
// la nouvelle langue alors que la page affichée a encore l'ancienne. Pendant
// le rendu serveur, l'appel est direct et la langue vient de l'URL.
export const localeFunctionMiddleware = createMiddleware({ type: "function" }).client(
  ({ next }) => {
    const router = typeof window === "undefined" ? undefined : window.__TSR_ROUTER__;
    if (!router) return next();
    const locale = router.latestLocation.pathname.split("/")[1] ?? "";
    return next({ headers: { [LOCALE_HEADER]: locale } });
  },
);
