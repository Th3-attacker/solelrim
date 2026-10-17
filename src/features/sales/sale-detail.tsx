import { useState } from "react";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "use-intl";
import { ButtonLink, Button } from "~/components/ui/button";
import { Dialog } from "~/components/ui/dialog";
import { Field, Select, Textarea } from "~/components/ui/field";
import { Icon } from "~/components/ui/icon";
import { Status, type StatusTone } from "~/components/ui/status";
import { notify } from "~/components/ui/toast";
import type { Locale } from "~/i18n/config";
import { useMoney } from "~/features/pos/till-parts";
import { useCommandError } from "~/features/pos/use-command-error";
import { SaleRefunds, useRefundInvalidation } from "./sale-refunds";
import { cancelSale, updateSale, type getSale } from "./sales.functions";
import { saleQuery } from "./sales.queries";

type Sale = NonNullable<Awaited<ReturnType<typeof getSale>>>;

// Un statut de vente et son ton, pour toutes les vues (Ventes, Mes ventes).
export const SALE_TONE: Record<string, StatusTone> = {
  COMPLETED: "ok",
  PARTIALLY_REFUNDED: "warn",
  REFUNDED: "bad",
  CANCELLED: "mute",
};

export function usePaymentLabel() {
  const t = useTranslations("sales");
  return (method: string | null, provider: string | null) =>
    method === "cash"
      ? t("cash")
      : method === "wallet"
        ? (provider ?? t("wallet"))
        : method === "card" || method === "transfer"
          ? t(method)
          : "—";
}

// A sale, in the side panel: the ticket, how it was paid and by whom, its
// refunds; and for an admin, correcting or cancelling it.
export function SaleDetail({ saleId, locale }: { saleId: string; locale: Locale }) {
  const t = useTranslations("sales");
  const tPos = useTranslations("pos");
  const format = useFormatter();
  const money = useMoney();
  const paymentLabel = usePaymentLabel();
  const { data: sale } = useSuspenseQuery(saleQuery(saleId));

  if (!sale) return <p className="p-5 text-muted">{t("saleNotFound")}</p>;

  const row =
    "flex items-baseline justify-between gap-3 border-b border-line-soft py-2 text-[14px] last:border-b-0";
  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Status tone={SALE_TONE[sale.status] ?? "mute"}>{t(`saleStatus.${sale.status}`)}</Status>
        {sale.closedTill && <span className="text-[12px] text-muted">{t("closedTillShort")}</span>}
      </div>
      <dl>
        <div className={row}>
          <dt className="text-muted">{t("date")}</dt>
          <dd className="font-semibold">
            {format.dateTime(sale.createdAt, { dateStyle: "medium", timeStyle: "short" })}
          </dd>
        </div>
        <div className={row}>
          <dt className="text-muted">{t("client")}</dt>
          <dd className="font-semibold">{sale.client?.fullName ?? t("walkInClient")}</dd>
        </div>
        {sale.sellerEmail && (
          <div className={row}>
            <dt className="text-muted">{tPos("receiptSeller")}</dt>
            <dd className="font-semibold">{sale.sellerEmail}</dd>
          </div>
        )}
        <div className={row}>
          <dt className="text-muted">{t("paymentMethod")}</dt>
          <dd className="font-semibold">{paymentLabel(sale.paymentMethod, sale.walletProvider)}</dd>
        </div>
      </dl>

      <section aria-labelledby="sale-items">
        <h3 id="sale-items" className="mb-1 text-[15px] font-bold">
          {t("itemsTitle")}
        </h3>
        <ul>
          {sale.items.map((item) => (
            <li key={item.id} className={row}>
              <span>
                {item.name}{" "}
                <span className="text-muted">
                  · {item.size} · {item.color}
                </span>{" "}
                × {item.quantity}
              </span>
              <span className="tabular-nums">{money(item.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-1">
          {sale.discount > 0 && (
            <div className={row}>
              <dt className="text-muted">{t("discount")}</dt>
              <dd>−{money(sale.discount)}</dd>
            </div>
          )}
          {sale.loyaltyDiscount > 0 && (
            <div className={row}>
              <dt className="text-muted">{tPos("loyaltyReward")}</dt>
              <dd>−{money(sale.loyaltyDiscount)}</dd>
            </div>
          )}
          <div className={row}>
            <dt className="font-bold">{t("total")}</dt>
            <dd className="text-[16px] font-bold text-brand">{money(sale.total)}</dd>
          </div>
          {sale.refundedAmount > 0 && (
            <div className={row}>
              <dt className="text-muted">{t("refundedAmount")}</dt>
              <dd className="text-bad-ink">−{money(sale.refundedAmount)}</dd>
            </div>
          )}
        </dl>
        {sale.notes && <p className="mt-2 text-[13px] text-ink-2">« {sale.notes} »</p>}
      </section>

      <div className="flex flex-wrap gap-2">
        <ButtonLink
          size="sm"
          to="/$locale/admin/pos/receipt/$saleId"
          params={{ locale, saleId: sale.id }}
        >
          <Icon name="print" className="size-4" />
          {tPos("receipt")}
        </ButtonLink>
        {sale.canManage && sale.status !== "CANCELLED" && <EditSale sale={sale} />}
        {sale.canManage && sale.status === "COMPLETED" && <CancelSale sale={sale} />}
      </div>

      {sale.refunds && <SaleRefunds refunds={sale.refunds} canDecide={sale.canManage} />}
    </div>
  );
}

// Only the payment and the note are corrected here; every change needs a
// reason and both values stay in the history.
function EditSale({ sale }: { sale: Sale }) {
  const t = useTranslations("saleEdit");
  const tSales = useTranslations("sales");
  const tCommon = useTranslations("common");
  const paymentLabel = usePaymentLabel();
  const showError = useCommandError("saleEdit.error");
  const invalidate = useRefundInvalidation();
  const [open, setOpen] = useState(false);
  const [payment, setPayment] = useState("keep");
  const [notes, setNotes] = useState(sale.notes ?? "");
  const [reason, setReason] = useState("");
  const paymentLocked =
    sale.refunds?.requests.some((request) => request.status !== "REJECTED") ?? false;

  const save = useMutation({
    mutationFn: () =>
      updateSale({
        data: {
          saleId: sale.id,
          paymentMethod: payment === "keep" ? null : payment === "cash" ? "cash" : "wallet",
          walletAccountId: payment === "keep" || payment === "cash" ? null : payment,
          clientId: sale.client?.id ?? null,
          notes: notes.trim(),
          reason: reason.trim(),
        },
      }),
    onSuccess: async (result) => {
      if (result.error) return showError(result.error);
      notify({ title: t("saved") });
      setOpen(false);
      setReason("");
      await invalidate();
    },
    onError: showError,
  });

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button size="sm">
          <Icon name="edit" className="size-4" />
          {tCommon("edit")}
        </Button>
      }
      title={t("title")}
      description={t("hint")}
      closeLabel={tCommon("cancel")}
      footer={
        <Button
          variant="primary"
          busy={save.isPending}
          disabled={reason.trim().length < 3}
          onClick={() => save.mutate()}
        >
          {tCommon("save")}
        </Button>
      }
    >
      <Field
        label={tSales("paymentMethod")}
        hint={
          paymentLocked
            ? t("paymentLockedHint")
            : t("currentPayment", { label: paymentLabel(sale.paymentMethod, sale.walletProvider) })
        }
      >
        {(control) => (
          <Select
            {...control}
            value={payment}
            disabled={paymentLocked}
            onChange={(event) => setPayment(event.target.value)}
          >
            <option value="keep">{paymentLabel(sale.paymentMethod, sale.walletProvider)}</option>
            <option value="cash">{tSales("cash")}</option>
            {sale.wallets.map((wallet) => (
              <option key={wallet.id} value={wallet.id}>
                {wallet.provider}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={tSales("notes")}>
        {(control) => (
          <Textarea
            {...control}
            maxLength={1000}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        )}
      </Field>
      <Field label={t("reason")} required>
        {(control) => (
          <Textarea
            {...control}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        )}
      </Field>
    </Dialog>
  );
}

// Voiding a sale: stock back on the shelf, loyalty points undone. Definitive.
function CancelSale({ sale }: { sale: Sale }) {
  const t = useTranslations("sales.cancelDialog");
  const showError = useCommandError("sales.cancelError");
  const invalidate = useRefundInvalidation();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const cancel = useMutation({
    mutationFn: () => cancelSale({ data: { saleId: sale.id, reason: reason.trim() } }),
    onSuccess: async (result) => {
      if (result.error) return showError(result.error);
      notify({ title: t("cancelled") });
      setOpen(false);
      await invalidate();
    },
    onError: showError,
  });

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button size="sm" className="text-bad-ink">
          {t("confirm")}
        </Button>
      }
      title={t("title")}
      description={t("hint")}
      closeLabel={t("keep")}
      footer={
        <>
          <Button onClick={() => setOpen(false)}>{t("keep")}</Button>
          <Button
            variant="danger"
            busy={cancel.isPending}
            disabled={reason.trim().length < 3}
            onClick={() => cancel.mutate()}
          >
            {t("confirm")}
          </Button>
        </>
      }
    >
      {sale.closedTill && (
        <p className="rounded-control bg-warn-bg px-3 py-2 text-[13px] text-warn-ink">
          {t("closedTill")}
        </p>
      )}
      <Field label={t("reason")}>
        {(control) => (
          <Textarea
            {...control}
            maxLength={500}
            placeholder={t("reasonPlaceholder")}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        )}
      </Field>
    </Dialog>
  );
}
