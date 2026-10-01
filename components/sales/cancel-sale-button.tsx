"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { StatusAlert } from "@/components/ui/status-alert";
import { Textarea } from "@/components/ui/textarea";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { cancelSale } from "@/lib/actions/sales";

const KNOWN_ERRORS = new Set(["invalid", "notFound", "alreadyCancelled", "refunded", "pendingRefund"]);

// Voids a whole sale. The reason is mandatory and kept in the history; when
// the sale's till is already closed the dialog warns that its frozen totals
// won't follow.
export function CancelSaleButton({
  saleId,
  tillClosed,
}: {
  saleId: string;
  tillClosed: boolean;
}) {
  const t = useTranslations("sales");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  const valid = reason.trim().length >= 3;

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelSale({ saleId, reason });
      if (result.error) {
        toast.error(
          KNOWN_ERRORS.has(result.error) ? t(`cancelError.${result.error}`) : tCommon("error"),
        );
        return;
      }
      setOpen(false);
      setReason("");
      router.refresh();
      toast.success(t("cancelled"));
    });
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button type="button" variant="outline" disabled={pending}>
          {tCommon("cancel")}
        </Button>
      }
      title={t("cancelDialog.title")}
      description={t("cancelDialog.hint")}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            {t("cancelDialog.keep")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!valid || pending}
            onClick={handleCancel}
          >
            {pending ? <Spinner /> : t("cancelDialog.confirm")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {tillClosed && <StatusAlert variant="warning">{t("cancelDialog.closedTill")}</StatusAlert>}
        <div className="flex flex-col gap-2">
          <Label htmlFor="sale-cancel-reason">{t("cancelDialog.reason")}</Label>
          <Textarea
            id="sale-cancel-reason"
            maxLength={500}
            value={reason}
            placeholder={t("cancelDialog.reasonPlaceholder")}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      </div>
    </ResponsiveFormDialog>
  );
}
