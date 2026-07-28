"use client";

import { LogOut } from "lucide-react";
import { useFormStatus } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import { logout } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

function LogoutSubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button variant="ghost" size="icon" type="submit" loading={pending} aria-label={label}>
      <LogOut className="size-4" />
    </Button>
  );
}

export function LogoutButton() {
  const t = useTranslations("nav");
  const locale = useLocale();

  return (
    <form action={logout.bind(null, locale)}>
      <LogoutSubmitButton label={t("logout")} />
    </form>
  );
}
