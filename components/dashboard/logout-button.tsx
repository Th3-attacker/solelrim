"use client";

import { LogOut } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { logout } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const t = useTranslations("nav");
  const locale = useLocale();

  return (
    <form action={logout.bind(null, locale)}>
      <Button variant="ghost" size="icon" type="submit" aria-label={t("logout")}>
        <LogOut className="size-4" />
      </Button>
    </form>
  );
}
