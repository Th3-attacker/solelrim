import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "use-intl";
import { LogoutButton } from "~/features/auth/logout-button";
import { shellQuery } from "~/features/shell/shell.queries";
import type { Locale } from "~/i18n/config";

const ROLE_KEY = {
  SUPERADMIN: "superadmin",
  BOUTIQUE_ADMIN: "boutiqueAdmin",
  SELLER: "seller",
} as const;

// Who is signed in, at the foot of the menu, and the way out.
export function Account({ locale }: { locale: Locale }) {
  const t = useTranslations("nav");
  const { data } = useSuspenseQuery(shellQuery);
  const { email, name, role } = data.admin;
  const shown = name ?? email;
  const initials = (
    name
      ? name
          .split(/\s+/)
          .map((part) => part[0])
          .join("")
      : email
  )
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-2.5 px-1">
      <span
        aria-hidden="true"
        className="inline-flex size-9 flex-none items-center justify-center rounded-full bg-tint text-[13px] font-bold text-brand"
      >
        {initials}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold" title={email}>
          {shown}
        </span>
        <span className="block text-[12px] text-muted">{t(ROLE_KEY[role])}</span>
      </span>
      <LogoutButton locale={locale} compact />
    </div>
  );
}
