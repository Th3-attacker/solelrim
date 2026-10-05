"use client";

import { useState, useTransition } from "react";
import { Trash } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast";
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

// The trash icon + confirmation dialog every "delete this row" action
// shares. The caller supplies what differs: the action, the texts, and what
// happens once it succeeded.
export function ConfirmDeleteButton({
  title,
  description,
  onDelete,
  errorMessage,
  onDeleted,
}: {
  title: string;
  description: string;
  onDelete: () => Promise<{ error?: string }>;
  errorMessage: (error: string) => string;
  onDeleted: () => void;
}) {
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await onDelete();
      if (result.error) {
        toast.error(errorMessage(result.error));
        return;
      }
      setOpen(false);
      onDeleted();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" disabled={pending} aria-label={tCommon("delete")}>
          <Trash className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={pending}>
            {pending ? <Spinner /> : tCommon("delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
