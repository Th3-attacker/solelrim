"use client";

import { useState, useTransition } from "react";
import { ChevronsUpDown, LogOut } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { getDirection } from "@/i18n/routing";
import { logout } from "@/lib/actions/auth";

function initials(email: string): string {
  return email.slice(0, 2).toUpperCase() || "?";
}

export function NavUser({
  email,
  roleLabel,
}: {
  email: string;
  roleLabel: string;
}) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { isMobile } = useSidebar();
  const [loggingOut, startLogout] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const avatar = (
    <Avatar className="size-8 rounded-lg">
      <AvatarFallback className="rounded-lg">{initials(email)}</AvatarFallback>
    </Avatar>
  );
  const nameBlock = (
    <div className="grid flex-1 text-start text-sm leading-tight">
      <span className="truncate font-medium">{roleLabel}</span>
      <span className="truncate text-xs text-muted-foreground">{email}</span>
    </div>
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip={roleLabel}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              {avatar}
              <div className="grid flex-1 text-start text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-medium">{roleLabel}</span>
                <span className="truncate text-xs text-muted-foreground">{email}</span>
              </div>
              <ChevronsUpDown className="ms-auto size-4 group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            side={isMobile ? "bottom" : getDirection(locale) === "rtl" ? "left" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5">
                {avatar}
                {nameBlock}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={loggingOut}
              onSelect={(event) => {
                event.preventDefault();
                setConfirmOpen(true);
              }}
            >
              {loggingOut ? <Spinner className="size-4" /> : <LogOut />}
              {t("logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("logoutConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("logoutConfirmDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loggingOut}>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={loggingOut}
              onClick={() => startLogout(() => logout(locale))}
            >
              {loggingOut ? <Spinner /> : t("logout")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarMenu>
  );
}
