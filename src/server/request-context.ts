import "server-only";
import { getRequest } from "@tanstack/react-start/server";
import type { Locale } from "@/i18n/routing";
import type { BrandedDomain } from "@/lib/services/branded-domain";

// Ce que le middleware de requête (src/middleware/request.ts) établit une fois
// par requête et que le reste du serveur lit ensuite : la langue, le nonce
// CSP, le domaine de marque éventuel… Remplace les en-têtes que proxy.ts
// ajoutait à la requête (x-nonce) et le contexte de next-intl.
export type AppRequestContext = {
  locale: Locale;
  nonce: string;
  branded: BrandedDomain | null;
  // Cookies posés pendant cette requête (rafraîchissement de la session
  // Supabase par le middleware, cookie de boutique…) : la suite de la même
  // requête doit les voir, comme le permettait request.cookies.set de Next.
  // null = cookie supprimé.
  cookieOverlay: Map<string, string | null>;
  // Une server action a-t-elle invalidé des données (revalidatePath…) ? Le
  // navigateur recharge alors la page, comme Next.js le faisait de lui-même.
  actionEffects: { revalidated: boolean };
};

// Rattaché à l'objet Request lui-même : il est le même du middleware jusqu'au
// rendu, et disparaît avec lui.
const contexts = new WeakMap<Request, AppRequestContext>();

export function setAppRequestContext(request: Request, context: AppRequestContext): void {
  contexts.set(request, context);
}

// null hors d'une requête Start (tests unitaires, scripts).
export function getAppRequestContext(): AppRequestContext | null {
  try {
    return contexts.get(getRequest()) ?? null;
  } catch {
    return null;
  }
}
