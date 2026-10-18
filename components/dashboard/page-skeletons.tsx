import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/ui/table-skeleton";

// Ex-loading.tsx du tableau de bord : affichés pendant le chargement d'une
// page (pendingComponent des routes de src/routes/$locale/admin/_dashboard).

// Ex-(dashboard)/loading.tsx.
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-40" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex flex-col gap-2 pt-6">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-4 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-5 w-full" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Ex-(dashboard)/audit-log/loading.tsx.
export function AuditLogSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <TableSkeleton columns={4} />
    </div>
  );
}

// Ex-(dashboard)/clients/loading.tsx.
export function ClientsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-32" />
      </div>
      <TableSkeleton columns={3} />
    </div>
  );
}

// Ex-(dashboard)/clients/[clientId]/loading.tsx.
export function ClientDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-24" />
      </div>

      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </CardContent>
      </Card>

      <div>
        <Skeleton className="mb-2 h-4 w-32" />
        <TableSkeleton columns={3} rows={3} />
      </div>
    </div>
  );
}

// Ex-(dashboard)/orders/loading.tsx.
export function OrdersSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-10 w-full max-w-2xl" />
      <TableSkeleton columns={7} />
    </div>
  );
}

// Ex-(dashboard)/orders/[orderId]/loading.tsx.
export function OrderDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>

      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full max-w-52" />
          ))}
        </CardContent>
      </Card>

      <TableSkeleton columns={4} rows={3} />

      <Skeleton className="h-48 w-full max-w-sm" />
    </div>
  );
}

// Ex-(dashboard)/products/loading.tsx.
export function ProductsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-32" />
      </div>
      <TableSkeleton columns={6} />
    </div>
  );
}

// Ex-(dashboard)/promo-codes/loading.tsx.
export function PromoCodesSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-32" />
      </div>
      <TableSkeleton columns={7} />
    </div>
  );
}

// Ex-(dashboard)/sales/loading.tsx.
export function SalesSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-32" />
      </div>
      <TableSkeleton columns={5} />
    </div>
  );
}

// Ex-(dashboard)/sales/[saleId]/loading.tsx.
export function SaleDetailSkeleton() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>

      <TableSkeleton columns={3} rows={4} />
    </div>
  );
}

// Ex-(dashboard)/settings/loading.tsx.
export function SettingsSkeleton() {
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
