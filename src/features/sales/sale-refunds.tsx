import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "use-intl";
import { computeRefund } from "@/lib/shop/refund";
import { Button } from "~/components/ui/button";
import { ConfirmDialog, Dialog } from "~/components/ui/dialog";
import { Field, Stepper, Textarea } from "~/components/ui/field";
import { Status, type StatusTone } from "~/components/ui/status";
import { notify } from "~/components/ui/toast";
import { useMoney } from "~/features/pos/till-parts";
import { useCommandError } from "~/features/pos/use-command-error";
import type { getSaleRefunds } from "@/lib/queries/refunds";
import { approveRefund, rejectRefund, requestRefund } from "./sales.functions";

type Refunds = NonNullable<Awaited<ReturnType<typeof getSaleRefunds>>>;
export type RefundRequestView = Refunds["requests"][number];

export const REFUND_TONE: Record<RefundRequestView["status"], StatusTone> = {
  PENDING: "pend",
  APPROVED: "ok",
  REJECTED: "bad",
};

// A refund moves stock, money (the approver's till for cash) and the
// sale's status: every view of them is read again.
export function useRefundInvalidation() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["sales"] }),
      queryClient.invalidateQueries({ queryKey: ["till"] }),
      queryClient.invalidateQueries({ queryKey: ["shell"] }),
      queryClient.invalidateQueries({ queryKey: ["orders", "dashboard"] }),
    ]);
}

// A sale's refunds: asking for one (seller or admin), and the requests with
// their decision. An admin approves or refuses the pending one.
export function SaleRefunds({ refunds, canDecide }: { refunds: Refunds; canDecide: boolean }) {
  const t = useTranslations("refunds");
  return (
    <section aria-labelledby="refunds-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="refunds-title" className="text-[15px] font-bold">
          {t("title")}
        </h3>
        {refunds.refundable && !refunds.hasPending && <RequestRefund refunds={refunds} />}
      </div>
      {refunds.hasPending && <p className="text-[13px] text-pend-ink">{t("pendingHint")}</p>}
      {refunds.requests.length > 0 && (
        <ul className="flex flex-col gap-2">
          {refunds.requests.map((request) => (
            <li key={request.id}>
              <RefundRequestCard request={request} canDecide={canDecide} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function RefundRequestCard({
  request,
  canDecide,
  saleLink,
}: {
  request: RefundRequestView;
  canDecide: boolean;
  saleLink?: React.ReactNode;
}) {
  const t = useTranslations("refunds");
  const format = useFormatter();
  const money = useMoney();
  const when = (date: Date) => format.dateTime(date, { dateStyle: "medium", timeStyle: "short" });
  return (
    <article className="flex flex-col gap-2 rounded-control border border-line p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <Status tone={REFUND_TONE[request.status]}>{t(`status.${request.status}`)}</Status>
          {saleLink}
        </span>
        {request.amount !== null && <b className="tabular-nums">{money(request.amount)}</b>}
      </div>
      <ul className="text-[13px] text-ink-2">
        {request.items.map((item, index) => (
          <li key={index}>
            {item.quantity} × {item.name} · {item.size} · {item.color}
          </li>
        ))}
      </ul>
      <p className="text-[13px]">« {request.reason} »</p>
      <p className="text-[12px] text-muted">
        {t("requestedBy", { email: request.requestedByEmail, date: when(request.createdAt) })}
        {request.decidedByEmail && request.decidedAt && (
          <>
            {" · "}
            {t(request.status === "APPROVED" ? "approvedBy" : "rejectedBy", {
              email: request.decidedByEmail,
              date: when(request.decidedAt),
            })}
          </>
        )}
      </p>
      {request.rejectionReason && (
        <p className="text-[13px] text-bad-ink">« {request.rejectionReason} »</p>
      )}
      {canDecide && request.status === "PENDING" && <RefundDecision request={request} />}
    </article>
  );
}

function RefundDecision({ request }: { request: RefundRequestView }) {
  const t = useTranslations("refunds");
  const tCommon = useTranslations("common");
  const money = useMoney();
  const showError = useCommandError("refunds.error");
  const invalidate = useRefundInvalidation();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const approve = useMutation({
    mutationFn: () => approveRefund({ data: { requestId: request.id } }),
    onSuccess: async (result) => {
      if (result.error) return showError(result.error);
      notify({ title: t("approved") });
      await invalidate();
    },
    onError: showError,
  });
  const reject = useMutation({
    mutationFn: () => rejectRefund({ data: { requestId: request.id, reason: reason.trim() } }),
    onSuccess: async (result) => {
      if (result.error) return showError(result.error);
      notify({ title: t("rejected") });
      setRejecting(false);
      await invalidate();
    },
    onError: showError,
  });

  const cash = request.salePaymentMethod === "cash";
  return (
    <div className="flex flex-wrap gap-2">
      <ConfirmDialog
        trigger={
          <Button size="sm" variant="primary" busy={approve.isPending}>
            {t("approveAction")}
          </Button>
        }
        title={t("approveConfirmTitle", { amount: money(request.amount ?? 0) })}
        description={
          cash
            ? t("approveConfirmCash")
            : t("approveConfirmWallet", { wallet: request.saleWalletProvider ?? t("wallet") })
        }
        cancelLabel={tCommon("cancel")}
        confirmLabel={t("approveAction")}
        tone="primary"
        onConfirm={() => approve.mutate()}
      />
      <Dialog
        open={rejecting}
        onOpenChange={setRejecting}
        trigger={
          <Button size="sm" className="text-bad-ink">
            {t("rejectAction")}
          </Button>
        }
        title={t("rejectTitle")}
        closeLabel={tCommon("cancel")}
        footer={
          <Button
            variant="danger"
            busy={reject.isPending}
            disabled={reason.trim().length < 3}
            onClick={() => reject.mutate()}
          >
            {t("rejectAction")}
          </Button>
        }
      >
        <Field label={t("rejectReason")}>
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
    </div>
  );
}

// Which units come back, and why. The amount is an estimate; the server
// computes the real one when the admin approves.
function RequestRefund({ refunds }: { refunds: Refunds }) {
  const t = useTranslations("refunds");
  const tCommon = useTranslations("common");
  const tPos = useTranslations("pos");
  const money = useMoney();
  const showError = useCommandError("refunds.error");
  const invalidate = useRefundInvalidation();
  const [open, setOpen] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");

  const lines = refunds.lines.map((line) => ({
    ...line,
    refundable: line.quantity - line.refundedQuantity,
    picked: quantities[line.saleItemId] ?? 0,
  }));
  const picked = lines.filter((line) => line.picked > 0);
  const estimate = computeRefund({
    subtotal: refunds.subtotal,
    total: refunds.total,
    refundedAmount: refunds.refundedAmount,
    loyaltyPointsEarned: 0,
    loyaltyPointsRedeemed: 0,
    previousPointsTakenBack: 0,
    previousPointsReturned: 0,
    lines: lines.map((line) => ({
      saleItemId: line.saleItemId,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      refundedQuantity: line.refundedQuantity,
      refundQuantity: line.picked,
    })),
  });

  const send = useMutation({
    mutationFn: () =>
      requestRefund({
        data: {
          saleId: refunds.saleId,
          items: picked.map((line) => ({ saleItemId: line.saleItemId, quantity: line.picked })),
          reason: reason.trim(),
        },
      }),
    onSuccess: async (result) => {
      if (result.error) return showError(result.error);
      notify({ title: t("requested") });
      setOpen(false);
      setQuantities({});
      setReason("");
      await invalidate();
    },
    onError: showError,
  });

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      trigger={<Button size="sm">{t("requestAction")}</Button>}
      title={t("requestTitle")}
      description={t("requestHint")}
      closeLabel={tCommon("cancel")}
      footer={
        <Button
          variant="primary"
          busy={send.isPending}
          disabled={picked.length === 0 || reason.trim().length < 3}
          onClick={() => send.mutate()}
        >
          {t("requestSubmit")}
        </Button>
      }
    >
      <Button
        size="sm"
        variant="quiet"
        className="self-start"
        onClick={() =>
          setQuantities(Object.fromEntries(lines.map((line) => [line.saleItemId, line.refundable])))
        }
      >
        {t("wholeSale")}
      </Button>
      <ul className="flex flex-col gap-3">
        {lines.map((line) => (
          <li key={line.saleItemId} className="flex items-center justify-between gap-3">
            <span className="min-w-0">
              <b className="block truncate text-[14px]">{line.name}</b>
              <span className="text-[12px] text-muted">
                {line.size} · {line.color} · {t("refundableOf", { count: line.refundable })}
              </span>
            </span>
            <Stepper
              value={line.picked}
              min={0}
              max={line.refundable}
              onChange={(value) =>
                setQuantities((current) => ({ ...current, [line.saleItemId]: value }))
              }
              label={t("quantityFor", { name: line.name })}
              decreaseLabel={tPos("decrease")}
              increaseLabel={tPos("increase")}
            />
          </li>
        ))}
      </ul>
      <Field label={t("reason")}>
        {(control) => (
          <Textarea
            {...control}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        )}
      </Field>
      {estimate && picked.length > 0 && (
        <p className="text-[14px] font-semibold">
          {t("estimate", { amount: money(estimate.amount) })}
        </p>
      )}
    </Dialog>
  );
}
