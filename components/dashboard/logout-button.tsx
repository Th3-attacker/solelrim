"use client";

import { useState, useTransition } from "react";
import { LogOut } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { logout } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function LogoutButton() {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await logout(locale);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("logout")}>
          <LogOut className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("logoutConfirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("logoutConfirmDescription")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{tCommon("cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={handleLogout} disabled={pending}>
            {pending ? <Spinner /> : t("logout")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
