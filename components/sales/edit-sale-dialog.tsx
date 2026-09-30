"use client";

import { useState } from "react";
import { PencilSimple } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateSale } from "@/lib/actions/sales";

const CASH = "cash";
// The recorded payment isn't one this form offers (legacy card/transfer, a
// wallet since deleted or renamed): kept as is unless another is picked.
const KEEP = "__keep__";
const WALKIN = "__walkin__";
const KNOWN_ERRORS = new Set([
  "invalid",
  "notFound",
  "notEditable",
  "noChanges",
  "paymentLocked",
  "clientLocked",
]);

// Admin only (updateSale refuses anyone else). Items and amounts are
// deliberately absent: an amount error goes through a refund.
export function EditSaleDialog({
  saleId,
  paymentMethod,
  walletProvider,
  clientId,
  notes,
  wallets,
  clients,
  paymentLocked,
  clientLocked,
}: {
  saleId: string;
  paymentMethod: string | null;
  walletProvider: string | null;
  clientId: string | null;
  notes: string | null;
  wallets: { id: string; provider: string }[];
  clients: { id: string; fullName: string }[];
  paymentLocked: boolean;
  clientLocked: boolean;
}) {
  const t = useTranslations("saleEdit");
  const tSales = useTranslations("sales");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const initialPayment =
    paymentMethod === "cash"
      ? CASH
      : paymentMethod === "wallet"
        ? (wallets.find((wallet) => wallet.provider === walletProvider)?.id ?? KEEP)
        : KEEP;
  const currentLabel =
    paymentMethod === "wallet"
      ? (walletProvider ?? tSales("wallet"))
      : paymentMethod === "card" || paymentMethod === "transfer"
        ? tSales(paymentMethod)
        : "—";
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [payment, setPayment] = useState(initialPayment);
  const [client, setClient] = useState(clientId ?? WALKIN);
  const [note, setNote] = useState(notes ?? "");
  const [reason, setReason] = useState("");

  const changed =
    payment !== initialPayment || client !== (clientId ?? WALKIN) || note.trim() !== (notes ?? "");
  const valid = changed && reason.trim().length >= 3;

  async function handleSave() {
    const result = await updateSale({
      saleId,
      // Untouched payment: keep what's recorded, never re-save it.
      paymentMethod: payment === initialPayment ? null : payment === CASH ? "cash" : "wallet",
      walletAccountId: payment === initialPayment || payment === CASH ? null : payment,
      clientId: client === WALKIN ? null : client,
      notes: note,
      reason,
    });
    if (result.error) {
      toast.error(KNOWN_ERRORS.has(result.error) ? t(`error.${result.error}`) : tCommon("error"));
      return;
    }
    toast.success(t("saved"));
    setOpen(false);
    setReason("");
    router.refresh();
  }

  return (
    <>
      <ResponsiveFormDialog
        open={open}
        onOpenChange={setOpen}
        trigger={
          <Button type="button" variant="outline">
            <PencilSimple className="size-4" />
            {tCommon("edit")}
          </Button>
        }
        title={t("title")}
        description={t("hint")}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="button" disabled={!valid} onClick={() => setConfirmOpen(true)}>
              {tCommon("save")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>{tSales("paymentMethod")}</Label>
            <Select value={payment} onValueChange={setPayment} disabled={paymentLocked}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {initialPayment === KEEP && (
                  <SelectItem value={KEEP}>{t("currentPayment", { label: currentLabel })}</SelectItem>
                )}
                <SelectItem value={CASH}>{tSales("cash")}</SelectItem>
                {wallets.map((wallet) => (
                  <SelectItem key={wallet.id} value={wallet.id}>
                    {wallet.provider}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {paymentLocked && <p className="text-xs text-muted-foreground">{t("paymentLockedHint")}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label>{tSales("client")}</Label>
            <Select value={client} onValueChange={setClient} disabled={clientLocked}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={WALKIN}>{tSales("walkInClient")}</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {clientLocked && <p className="text-xs text-muted-foreground">{t("clientLockedHint")}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sale-edit-notes">{tSales("notes")}</Label>
            <Textarea
              id="sale-edit-notes"
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sale-edit-reason">{t("reason")}</Label>
            <Textarea
              id="sale-edit-reason"
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
      </ResponsiveFormDialog>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("confirmTitle")}
        description={t("confirmBody")}
        confirmLabel={tCommon("save")}
        onConfirm={handleSave}
      />
    </>
  );
}
