import type { Metadata } from "next";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { ModeToggle } from "@/components/mode-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LicenseWarningBanner } from "@/components/settings/license-warning-banner";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getAdminScope } from "@/lib/shop/admin-scope";
import { getStoreTypes } from "@/lib/queries/settings";
import { getPendingOrderCount } from "@/lib/queries/orders";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

// robots.ts already disallows /{locale}/admin for crawling, but that alone
// doesn't stop a URL from getting indexed if it's linked from elsewhere —
// this is the actual no-index directive for the dashboard.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [storeTypes, currentScope, admin, supabase] = await Promise.all([
    getStoreTypes(),
    getAdminScope(),
    getCurrentAdmin(),
    createClient(),
  ]);
  const [{ data: { user } }, pendingOrderCount] = await Promise.all([
    supabase.auth.getUser(),
    getPendingOrderCount(currentScope),
  ]);

  const currentStoreType = storeTypes.find((type) => type.key === currentScope);

  return (
    <TooltipProvider>
      <SidebarProvider>
        <div className="print:hidden">
          <AppSidebar
            storeTypes={storeTypes}
            currentScope={currentScope}
            role={admin.role}
            email={user?.email ?? ""}
            pendingOrderCount={pendingOrderCount}
          />
        </div>
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 print:hidden">
            <SidebarTrigger className="-ms-1" />
            <Separator orientation="vertical" className="h-4" />
            <div className="ms-auto flex items-center gap-1">
              <LanguageSwitcher />
              <ModeToggle />
              <LogoutButton />
            </div>
          </header>
          {currentStoreType && (
            <div className="print:hidden">
              <LicenseWarningBanner
                license={{
                  licenseType: currentStoreType.licenseType,
                  licenseStatus: currentStoreType.licenseStatus,
                  licenseExpiresAt: currentStoreType.licenseExpiresAt,
                }}
              />
            </div>
          )}
          <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
