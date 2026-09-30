"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
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

// The app's one confirmation popup (same look as the logout one) for any
// action that can't be undone. Either wraps a trigger button, or is opened
// by the caller (open/onOpenChange) — e.g. after a form validated.
export function ConfirmDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  onConfirm,
}: {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  // The popup stays open (showing a spinner) until this settles, then
  // closes — the caller reports errors itself (toast).
  onConfirm: () => Promise<unknown> | void;
}) {
  const tCommon = useTranslations("common");
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const open = controlledOpen ?? uncontrolledOpen;

  function setOpen(next: boolean) {
    // Never dismissed mid-action: the result would land on a closed popup.
    if (pending) return;
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  }

  function handleConfirm(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    startTransition(async () => {
      try {
        await onConfirm();
      } finally {
        setUncontrolledOpen(false);
        onOpenChange?.(false);
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{tCommon("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={pending}
          >
            {pending ? <Spinner /> : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
