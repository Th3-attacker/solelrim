"use client";

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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("label")}>
          <Translate className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {routing.locales.map((nextLocale) => (
          <DropdownMenuItem
            key={nextLocale}
            disabled={nextLocale === locale}
            onClick={() => {
              router.replace(pathname, { locale: nextLocale });
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
