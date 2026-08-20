"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Translate } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function LanguageSwitcher({
  onSelect,
}: {
  // MobileNav renders this inside its own Sheet — that outer Sheet never
  // heard about the pick (nothing told it to close), so it sat there open
  // on top of the page that had, in fact, already switched locale
  // underneath it. Every other row in that same nav closes it on click;
  // this was the one exception. Optional because the header's standalone
  // instance has no outer sheet to close.
  onSelect?: () => void;
} = {}) {
  const t = useTranslations("language");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  // Switching locale re-renders the whole route from the server (every
  // layout/page under [locale] refetches its data), so there's a real gap
  // between the click and the new page landing — without this, the menu
  // just closes and nothing visibly happens until it does. startTransition
  // surfaces that gap as an immediate spinner instead of dead air.
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("label")} loading={pending}>
          <Translate className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {routing.locales.map((nextLocale) => (
          <DropdownMenuItem
            key={nextLocale}
            disabled={nextLocale === locale || pending}
            onClick={() => {
              startTransition(() => {
                router.replace(pathname, { locale: nextLocale });
              });
              onSelect?.();
            }}
          >
            {t(nextLocale)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
