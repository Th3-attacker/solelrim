import { Skeleton } from "@/components/ui/skeleton";

// Ex-loading.tsx de la boutique : affichés pendant le chargement d'une page
// (pendingComponent des routes de src/routes/$locale/$storeType/_shop).

export function ShopHomeSkeleton() {
  return (
    <div className="flex flex-col gap-14">
      <Skeleton className="h-80 w-full rounded-2xl" />

      <div className="flex flex-col gap-6">
        <Skeleton className="h-6 w-40" />
        <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 desktop:grid-cols-4 desktop:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="aspect-square w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProductDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-5 w-64" />

      <div className="grid gap-8 md:grid-cols-2">
        <Skeleton className="aspect-square w-full rounded-lg" />

        <div className="flex flex-col gap-3">
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="mt-4 h-10 w-full max-w-xs" />
        </div>
      </div>
    </div>
  );
}
