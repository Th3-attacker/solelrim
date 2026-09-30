"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { approveRefund, rejectRefund } from "@/lib/actions/refunds";
import { formatPrice } from "@/lib/format/currency";
import { useRefundError } from "@/components/refunds/use-refund-error";

// Admin only (the actions refuse anyone else).
export function RefundDecision({
  requestId,
  amount,
  paymentMethod,
  walletProvider,
}: {
  requestId: string;
  amount: number | null;
  paymentMethod: string | null;
  walletProvider: string | null;
}) {
  const t = useTranslations("refunds");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const showError = useRefundError();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [rejecting, startReject] = useTransition();

  async function handleApprove() {
    const result = await approveRefund({ requestId });
    if (result.error) return showError(result.error);
    toast.success(t("approved"));
    router.refresh();
  }

  function handleReject() {
    startReject(async () => {
      const result = await rejectRefund({ requestId, reason });
      if (result.error) return showError(result.error);
      toast.success(t("rejected"));
      setRejectOpen(false);
      setReason("");
      router.refresh();
    });
  }

  const money =
    amount === null ? "—" : formatPrice(amount, tCommon("currency"));

  return (
    <div className="flex flex-wrap gap-2">
      <ConfirmDialog
        trigger={
          <Button type="button" size="sm">
            {t("approveAction")}
          </Button>
        }
        title={t("approveConfirmTitle", { amount: money })}
        description={
          paymentMethod === "cash"
            ? t("approveConfirmCash")
            : t("approveConfirmWallet", {
                wallet: walletProvider ?? t("wallet"),
              })
        }
        confirmLabel={t("approveAction")}
        onConfirm={handleApprove}
      />
      <ResponsiveFormDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        trigger={
          <Button type="button" size="sm" variant="outline">
            {t("rejectAction")}
          </Button>
        }
        title={t("rejectTitle")}
        footer={
          <>
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
              loading={rejecting}
              disabled={reason.trim().length < 3}
              onClick={handleReject}
            >
              {t("rejectAction")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor={`refund-reject-${requestId}`}>
            {t("rejectReason")}
          </Label>
          <Textarea
            id={`refund-reject-${requestId}`}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      </ResponsiveFormDialog>
    </div>
  );
}
