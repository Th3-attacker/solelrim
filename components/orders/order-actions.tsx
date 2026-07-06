"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
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
import { confirmOrder, rejectOrder } from "@/lib/actions/orders";

export function OrderActions({ orderId }: { orderId: string }) {
  const t = useTranslations("orders");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await confirmOrder(orderId);
      if (result.error) {
        toast.error(
          result.error === "insufficientStock"
            ? t("insufficientStockError")
            : t("alreadyProcessed"),
        );
        return;
      }
      router.refresh();
      toast.success(t("confirmAction"));
    });
  }

  function handleReject() {
    startTransition(async () => {
      const result = await rejectOrder(orderId);
      if (result.error) {
        toast.error(t("alreadyProcessed"));
        return;
      }
      router.refresh();
      toast.success(t("rejectAction"));
    });
  }

  return (
    <div className="flex gap-2">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button disabled={pending}>{t("confirmAction")}</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmActionConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("insufficientStockError")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              {tCommon("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Button variant="outline" disabled={pending} onClick={handleReject}>
        {t("rejectAction")}
      </Button>
    </div>
  );
}
