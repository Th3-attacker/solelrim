import { createFileRoute, Outlet } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { LiveOrders } from "@/components/dashboard/live-orders";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ModeToggle } from "@/components/mode-toggle";
import { LicenseWarningBanner } from "@/components/settings/license-warning-banner";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getCurrentAdmin, getSessionUser } from "@/lib/auth/admin";
import { getAdminScope } from "@/lib/auth/scope";
import { getPendingOrderCount } from "@/lib/queries/orders";
import { countPendingRefunds } from "@/lib/queries/refunds";
import { getStoreTypes } from "@/lib/queries/settings";

// Ex-app/[locale]/admin/(dashboard)/layout.tsx.

const loadDashboardLayout = createServerFn({ method: "GET" }).handler(async () => {
  const [storeTypes, admin] = await Promise.all([getStoreTypes(), getCurrentAdmin()]);
  // getAdminScope() refuses a SELLER (it guards every admin data page), but
  // this layout also wraps the checkout a seller does use — a seller's
  // scope is simply their own locked boutique.
  const currentScope = admin.role === "SELLER" ? admin.productType! : await getAdminScope();
  // getSessionUser is the request's cached getUser(): getCurrentAdmin above
  // already made that round trip to Supabase Auth.
  const [user, pendingOrderCount, pendingRefundCount] = await Promise.all([
    getSessionUser(),
    getPendingOrderCount(currentScope),
    // Only an admin decides refunds, so only they get the badge.
    admin.role === "SELLER" ? Promise.resolve(0) : countPendingRefunds(currentScope),
  ]);

  const currentStoreType = storeTypes.find((type) => type.key === currentScope);

  return {
    // robots.txt already disallows /{locale}/admin for crawling, but that
    // alone doesn't stop a URL from getting indexed if it's linked from
    // elsewhere — this is the actual no-index directive for the dashboard.
    meta: { robots: { index: false, follow: false } },
    storeTypes: storeTypes.map((type) => ({ key: type.key, label: type.label })),
    currentScope,
    role: admin.role,
    email: user?.email ?? "",
    pendingOrderCount,
    pendingRefundCount,
    license: currentStoreType
      ? {
          licenseType: currentStoreType.licenseType,
          licenseStatus: currentStoreType.licenseStatus,
          licenseExpiresAt: currentStoreType.licenseExpiresAt,
        }
      : null,
  };
});

export const Route = createFileRoute("/$locale/admin/_dashboard")({
  loader: () => loadDashboardLayout(),
  // Comme un layout Next.js : rechargé après une écriture (invalidation), pas
  // à chaque navigation — les compteurs se mettent à jour en direct par
  // LiveOrders, qui invalide la page lui-même.
  staleTime: Infinity,
  component: DashboardLayout,
});

function DashboardLayout() {
  const layout = Route.useLoaderData();

  return (
    <TooltipProvider>
      <SidebarProvider>
        <div className="print:hidden">
          <AppSidebar
            storeTypes={layout.storeTypes}
            currentScope={layout.currentScope}
            role={layout.role}
            email={layout.email}
            pendingOrderCount={layout.pendingOrderCount}
            pendingRefundCount={layout.pendingRefundCount}
          />
        </div>
        <SidebarInset>
          <LiveOrders productType={layout.currentScope} />
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 print:hidden">
            <SidebarTrigger className="-ms-1" />
            <Separator orientation="vertical" className="h-4" />
            <div className="ms-auto flex items-center gap-1">
              <LanguageSwitcher />
              <ModeToggle />
              <LogoutButton />
            </div>
          </header>
          {layout.license && (
            <div className="print:hidden">
              <LicenseWarningBanner license={layout.license} />
            </div>
          )}
          <div className="min-w-0 flex-1 p-4 md:p-6 print:p-0">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
