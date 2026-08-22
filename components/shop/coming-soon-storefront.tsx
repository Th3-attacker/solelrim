import Image from "next/image";
import { Sparkle, WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { getTranslations } from "next-intl/server";

// Replaces the entire storefront (rendered by the (shop) layout instead of
// {children}) as long as this boutique has zero active products — every
// page under this boutique's route shows this instead of shop content.
// Disappears on its own the moment the first real product goes active, so
// there's nothing to remember to turn off. Mirrors ExpiredStorefront.
export async function ComingSoonStorefront({
  siteName,
  logoUrl,
  whatsappHref,
}: {
  siteName: string;
  logoUrl: string | null;
  whatsappHref: string | null;
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
          <Sparkle className="size-6" />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-widest text-muted-foreground uppercase">
          {siteName}
        </p>
        <h1 className="text-heading-md text-balance">{t("comingSoonTitle")}</h1>
        <p className="max-w-sm text-paragraph-md text-muted-foreground">
          {t("comingSoonMessage")}
        </p>
      </div>
      {whatsappHref && (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <WhatsappLogo className="size-4" weight="fill" />
          {t("comingSoonContactWhatsapp")}
        </a>
      )}
    </div>
  );
}
