"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { shipOrder, deliverOrder, cancelOrder } from "@/lib/actions/orders";

export function OrderProgressActions({
  orderId,
  status,
}: {
  orderId: string;
  status: "CONFIRMED" | "SHIPPING";
}) {
  const t = useTranslations("orders");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");

  function handleAdvance() {
    startTransition(async () => {
      const action = status === "CONFIRMED" ? shipOrder : deliverOrder;
      const result = await action(orderId);
      if (result.error) {
        toast.error(t("alreadyProcessed"));
        return;
      }
      router.refresh();
      toast.success(status === "CONFIRMED" ? t("shipAction") : t("deliverAction"));
    });
  }

  function handleCancel() {
    const trimmed = reason.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const result = await cancelOrder(orderId, trimmed);
      if (result.error) {
        toast.error(t("alreadyProcessed"));
        return;
      }
      setCancelOpen(false);
      setReason("");
      router.refresh();
      toast.success(t("cancelAction"));
    });
  }

  return (
    <div className="flex gap-2">
      <Button loading={pending} onClick={handleAdvance}>
        {status === "CONFIRMED" ? t("shipAction") : t("deliverAction")}
      </Button>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" disabled={pending}>
            {t("cancelAction")}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("cancelActionConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("cancelReasonHint")}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("cancelReasonPlaceholder")}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              loading={pending}
              disabled={!reason.trim()}
              onClick={handleCancel}
            >
              {tCommon("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
