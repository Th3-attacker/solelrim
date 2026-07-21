"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { confirmOrder, rejectOrder } from "@/lib/actions/orders";
import { REJECT_REASON_PRESETS } from "@/lib/shop/client-messages";

const REASON_LABEL_KEYS: Record<(typeof REJECT_REASON_PRESETS)[number], string> = {
  invalid_payment: "reasonInvalidPayment",
  out_of_stock: "reasonOutOfStock",
  undeliverable_location: "reasonUndeliverableLocation",
};

export function OrderActions({ orderId }: { orderId: string }) {
  const t = useTranslations("orders");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reasonPreset, setReasonPreset] = useState<string>(REJECT_REASON_PRESETS[0]);
  const [customReason, setCustomReason] = useState("");

  const isOther = reasonPreset === "other";
  const finalReason = isOther ? customReason.trim() : reasonPreset;

  function handleConfirm(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
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
      setConfirmOpen(false);
      router.refresh();
      toast.success(t("confirmAction"));
    });
  }

  function handleReject() {
    if (!finalReason) return;
    startTransition(async () => {
      const result = await rejectOrder(orderId, finalReason);
      if (result.error) {
        toast.error(t("alreadyProcessed"));
        return;
      }
      setRejectOpen(false);
      setReasonPreset(REJECT_REASON_PRESETS[0]);
      setCustomReason("");
      router.refresh();
      toast.success(t("rejectAction"));
    });
  }

  return (
    <div className="flex gap-2">
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
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
            <AlertDialogAction onClick={handleConfirm} disabled={pending}>
              {pending ? <Spinner /> : tCommon("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" disabled={pending}>
            {t("rejectAction")}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("rejectAction")}</DialogTitle>
            <DialogDescription>{t("rejectReasonLabel")}</DialogDescription>
          </DialogHeader>

          <Select value={reasonPreset} onValueChange={setReasonPreset}>
            <SelectTrigger>
              <SelectValue placeholder={t("selectReasonPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {REJECT_REASON_PRESETS.map((preset) => (
                <SelectItem key={preset} value={preset}>
                  {t(REASON_LABEL_KEYS[preset])}
                </SelectItem>
              ))}
              <SelectItem value="other">{t("reasonOther")}</SelectItem>
            </SelectContent>
          </Select>

          {isOther && (
            <Textarea
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder={t("reasonOtherPlaceholder")}
            />
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRejectOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              loading={pending}
              disabled={!finalReason}
              onClick={handleReject}
            >
              {tCommon("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
