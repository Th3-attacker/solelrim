"use client";

import { lazy, Suspense, type ComponentProps } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Recharts pèse ~105 Ko gzip : chargé à part, il ne retarde plus le reste de
// l'accueil du dashboard (cartes de statistiques, meilleures ventes, stocks).
// Au premier affichage, le graphique arrive déjà rendu par le serveur ; lors
// d'une navigation côté client, le squelette tient sa place le temps du
// téléchargement.
const RevenueChart = lazy(() =>
  import("@/components/dashboard/revenue-chart").then((m) => ({ default: m.RevenueChart })),
);

// Mêmes dimensions que RevenueChart (sélecteur de période + zone h-64), pour
// éviter tout décalage de mise en page à l'arrivée du graphique.
function RevenueChartSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <div className="flex justify-end">
        <Skeleton className="h-9 w-40" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export function LazyRevenueChart(props: ComponentProps<typeof RevenueChart>) {
  return (
    <Suspense fallback={<RevenueChartSkeleton />}>
      <RevenueChart {...props} />
    </Suspense>
  );
}
