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
import { getAdminScope } from "@/lib/shop/admin-scope";
import { getStoreTypes } from "@/lib/queries/settings";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { getLicenseStatus } from "@/lib/shop/license";
import { createClient } from "@/lib/supabase/server";

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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const currentLicenseExpiresAt =
    storeTypes.find((type) => type.key === currentScope)?.licenseExpiresAt ?? null;

  return (
    <SidebarProvider>
      <div className="print:hidden">
        <AppSidebar
          storeTypes={storeTypes}
          currentScope={currentScope}
          role={admin.role}
          email={user?.email ?? ""}
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
        <div className="print:hidden">
          <LicenseWarningBanner
            status={getLicenseStatus(currentLicenseExpiresAt)}
            expiresAt={currentLicenseExpiresAt}
          />
        </div>
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
