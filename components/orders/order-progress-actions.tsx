"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Textarea } from "@/components/ui/textarea";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
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
  const [advancePending, setAdvancePending] = useState(false);
  const [cancelPending, startCancelTransition] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");

  async function handleAdvance() {
    setAdvancePending(true);
    try {
      const action = status === "CONFIRMED" ? shipOrder : deliverOrder;
      const result = await action(orderId);
      if (result.error) {
        toast.error(t("alreadyProcessed"));
        return;
      }
      router.refresh();
      toast.success(status === "CONFIRMED" ? t("shipAction") : t("deliverAction"));
    } finally {
      setAdvancePending(false);
    }
  }

  function handleCancel() {
    const trimmed = reason.trim();
    if (!trimmed) return;
    startCancelTransition(async () => {
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
      <ConfirmDialog
        trigger={
          <Button loading={advancePending} disabled={cancelPending}>
            {status === "CONFIRMED" ? t("shipAction") : t("deliverAction")}
          </Button>
        }
        title={t(status === "CONFIRMED" ? "shipConfirmTitle" : "deliverConfirmTitle")}
        description={t(status === "CONFIRMED" ? "shipConfirmBody" : "deliverConfirmBody")}
        confirmLabel={status === "CONFIRMED" ? t("shipAction") : t("deliverAction")}
        onConfirm={handleAdvance}
      />

      <ResponsiveFormDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        trigger={
          <Button variant="outline" disabled={advancePending || cancelPending}>
            {t("cancelAction")}
          </Button>
        }
        title={t("cancelActionConfirmTitle")}
        description={t("cancelReasonHint")}
        footer={
          <>
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
              loading={cancelPending}
              disabled={!reason.trim()}
              onClick={handleCancel}
            >
              {tCommon("confirm")}
            </Button>
          </>
        }
      >
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("cancelReasonPlaceholder")}
        />
      </ResponsiveFormDialog>
    </div>
  );
}
