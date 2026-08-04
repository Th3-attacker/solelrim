import { Skeleton } from "@/components/ui/skeleton";

export default function ShopHomeLoading() {
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
