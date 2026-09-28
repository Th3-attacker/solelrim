import Image from "next/image";
import { Prohibit } from "@phosphor-icons/react/dist/ssr";
import { getTranslations } from "next-intl/server";

// Replaces the entire storefront (rendered by the (shop) layout instead of
// {children}) once the boutique's license is SUSPENDED, EXPIRED, or
// CANCELLED (lib/shop/license.ts: isLicenseBlocking) — every page under
// this boutique's route shows this instead of shop content, regardless of
// which of the three caused it. The admin dashboard is untouched: a
// boutique/superadmin can still sign in and see the license section to
// reactivate it (only sensitive write actions are blocked there — see
// lib/shop/admin-scope.ts: requireWritableAdminScope).
export async function ExpiredStorefront({
  siteName,
  logoUrl,
}: {
  siteName: string;
  logoUrl: string | null;
}) {
  const t = await getTranslations("shop");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt=""
          width={56}
          height={56}
          className="size-14 object-contain"
        />
      ) : (
        <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Prohibit className="size-6" />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-widest text-muted-foreground uppercase">
          {siteName}
        </p>
        <h1 className="text-heading-md text-balance">{t("storefrontExpiredTitle")}</h1>
        <p className="max-w-sm text-paragraph-md text-muted-foreground">
          {t("storefrontExpiredMessage")}
        </p>
      </div>
    </div>
  );
}
