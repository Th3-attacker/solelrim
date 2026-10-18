import { AdminError } from "@/components/errors/admin-error";
import { AdminNotFound } from "@/components/errors/admin-not-found";
import { DashboardSkeleton } from "@/components/dashboard/page-skeletons";

// Les frontières des pages du tableau de bord (ex-error.tsx, not-found.tsx et
// loading.tsx du groupe (dashboard)) : erreur, page introuvable et squelette
// s'affichent à la place de la page, dans le cadre du tableau de bord (barre
// latérale comprise). Une page au squelette propre remplace pendingComponent.
export const adminPageBoundaries = {
  errorComponent: AdminError,
  notFoundComponent: AdminNotFound,
  pendingComponent: DashboardSkeleton,
} as const;
