import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function SettingsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-24" />
      </div>

      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, j) => (
              <Skeleton key={j} className="h-9 w-full" />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
