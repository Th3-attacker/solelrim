import { useState, type ReactNode } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { formatPriceNumber } from "@/lib/format/currency";
import { REASON_LABEL_KEY, REJECT_REASON_PRESETS } from "@/lib/shop/order-reasons";
import { cn } from "~/lib/cn";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { ConfirmDialog, Dialog } from "~/components/ui/dialog";
import { Choice, Field, Select, Textarea } from "~/components/ui/field";
import { Icon, type IconName } from "~/components/ui/icon";
import type { OrderStatus } from "./order-status";
import type { getOrder } from "./orders.functions";
import { useOrderTransition } from "./use-order-transition";

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrder>>>;

export function useMoney() {
  const currency = useTranslations("common")("currency");
  return (value: number) => `${formatPriceNumber(value)} ${currency}`;
}

// A stored reason: a preset reads in the admin's language, the admin's own
// words as they were written.
export function useReasonLabel() {
  const t = useTranslations("orders");
  return (reason: string) => {
    const key = REASON_LABEL_KEY[reason];
    return key ? t(key) : reason;
  };
}

function KeyValue({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line-soft py-2 text-[14px] last:border-b-0">
      <dt className="text-muted">{label}</dt>
      <dd className="text-end font-semibold">{children}</dd>
    </div>
  );
}

// The screenshot the customer sent, what to check on it, and whether the
// same image already came with another order.
export function PaymentProof({
  order,
  linkToOrder,
}: {
  order: OrderDetail;
  linkToOrder: (id: string, reference: string) => ReactNode;
}) {
  const t = useTranslations("orders");
  const money = useMoney();
  const [zoom, setZoom] = useState(false);
  const { payment } = order;

  return (
    <Card as="section" aria-labelledby="proof-title" className="p-5">
      <h2 id="proof-title" className="text-card-title">
        {t("paymentProofTitle")}
      </h2>
      {payment.proofSharedWith.length > 0 && (
        <p
          role="alert"
          className="mt-3 rounded-control bg-warn-bg px-3 py-2 text-[13px] text-warn-ink"
        >
          <b>{t("proofReused")}</b>{" "}
          {payment.proofSharedWith.map((other, index) => (
            <span key={other.id}>
              {index > 0 && ", "}
              {linkToOrder(other.id, other.reference)}
            </span>
          ))}
        </p>
      )}
      <div className="mt-4 grid gap-5 sm:grid-cols-[200px_minmax(0,1fr)]">
        {payment.proofUrl ? (
          <button
            type="button"
            onClick={() => setZoom(true)}
            className="group relative overflow-hidden rounded-control border border-line bg-tile"
          >
            <img
              src={payment.proofUrl}
              alt={t("paymentProof")}
              className="h-72 w-full object-contain sm:h-80"
            />
            <span className="absolute end-2 bottom-2 inline-flex items-center gap-1 rounded-lg bg-surface/90 px-2 py-1 text-[12px] font-semibold text-ink">
              <Icon name="search" className="size-3.5" />
              {t("openProof")}
            </span>
          </button>
        ) : (
          <p className="flex h-40 items-center justify-center rounded-control border border-line bg-tile p-4 text-center text-[13px] text-muted">
            {t("proofUnavailable")}
          </p>
        )}
        <div>
          <dl>
            <KeyValue label={t("paymentSenderPhone")}>
              <span dir="ltr">{payment.senderPhone ?? "—"}</span>
            </KeyValue>
            <KeyValue label={t("expectedAmount")}>{money(order.total)}</KeyValue>
            <KeyValue label={t("paymentTransactionId")}>
              <span dir="ltr" className="font-mono">
                {payment.transactionId ?? "—"}
              </span>
            </KeyValue>
          </dl>
          {order.status === "PENDING" && (
            <fieldset className="mt-4 flex flex-col rounded-control bg-bg p-3.5">
              <legend className="float-start mb-1 text-[13px] font-bold">
                {t("beforeConfirming")}
              </legend>
              <Choice label={t("checkProofAmount", { amount: money(order.total) })} />
              <Choice label={t("checkMoneyReceived")} />
              <Choice label={t("checkTransactionUnused")} />
            </fieldset>
          )}
        </div>
      </div>
      {payment.proofUrl && (
        <Dialog
          open={zoom}
          onOpenChange={setZoom}
          title={t("paymentProof")}
          closeLabel={t("goBack")}
        >
          <img
            src={payment.proofUrl}
            alt={t("paymentProof")}
            className="max-h-[75dvh] w-full object-contain"
          />
        </Dialog>
      )}
    </Card>
  );
}

export function OrderItems({ order }: { order: OrderDetail }) {
  const t = useTranslations("orders");
  const money = useMoney();
  return (
    <Card as="section" aria-labelledby="items-title" className="p-5">
      <h2 id="items-title" className="text-card-title">
        {t("itemsTitle")}
      </h2>
      <ul className="mt-3">
        {order.items.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-3 border-b border-line-soft py-3 last:border-b-0"
          >
            <span className="min-w-0 flex-1">
              <b className="block truncate text-[14px] font-semibold">{item.name}</b>
              <span className="text-[12px] text-muted">
                {item.size} · {item.color}
              </span>
            </span>
            <span className="text-[13px] text-muted tabular-nums">× {item.quantity}</span>
            <b className="w-28 text-end text-[14px] tabular-nums">{money(item.lineTotal)}</b>
          </li>
        ))}
      </ul>
      <dl className="mt-2 border-t border-line pt-2">
        <KeyValue label={t("subtotal")}>{money(order.subtotal)}</KeyValue>
        {order.promoCode && (
          <KeyValue label={t("promoCodeLine", { code: order.promoCode })}>
            − {money(order.discount)}
          </KeyValue>
        )}
        <KeyValue label={<b className="text-ink">{t("totalPaid")}</b>}>
          <span className="text-[16px] text-brand">{money(order.total)}</span>
        </KeyValue>
      </dl>
    </Card>
  );
}

type Step = {
  key: string;
  label: string;
  date: Date | null;
  icon: IconName;
  tone: "done" | "current" | "todo" | "bad";
};

function steps(order: OrderDetail, t: ReturnType<typeof useTranslations<"orders">>): Step[] {
  const reached = (status: OrderStatus) =>
    ["PENDING", "CONFIRMED", "SHIPPING", "DELIVERED"].indexOf(order.status) >=
    ["PENDING", "CONFIRMED", "SHIPPING", "DELIVERED"].indexOf(status);
  const list: Step[] = [
    {
      key: "received",
      label: t("stepReceived"),
      date: order.createdAt,
      icon: "orders",
      tone: "done",
    },
  ];
  if (order.status === "REJECTED") {
    return [
      ...list,
      {
        key: "rejected",
        label: t("stepRejected"),
        date: order.rejectedAt,
        icon: "close",
        tone: "bad",
      },
    ];
  }
  list.push(
    {
      key: "confirmed",
      label: t("stepConfirmed"),
      date: order.confirmedAt,
      icon: "check",
      tone: reached("CONFIRMED") ? "done" : "todo",
    },
    {
      key: "shipping",
      label: t("stepShipping"),
      date: order.shippedAt,
      icon: "pos",
      tone: reached("SHIPPING") ? "done" : "todo",
    },
    {
      key: "delivered",
      label: t("stepDelivered"),
      date: order.deliveredAt,
      icon: "dashboard",
      tone: reached("DELIVERED") ? "done" : "todo",
    },
  );
  if (order.status === "CANCELLED") {
    return [
      ...list.filter((step) => step.tone === "done"),
      {
        key: "cancelled",
        label: t("stepCancelled"),
        date: order.cancelledAt,
        icon: "close",
        tone: "bad",
      },
    ];
  }
  // The next step to take stands out.
  const next = list.find((step) => step.tone === "todo");
  if (next) next.tone = "current";
  return list;
}

// Where the order stands, and the one action that moves it on.
export function OrderTracking({ order }: { order: OrderDetail }) {
  const t = useTranslations("orders");
  const format = useFormatter();
  const reasonLabel = useReasonLabel();

  return (
    <Card as="section" aria-labelledby="tracking-title" className="p-5">
      <h2 id="tracking-title" className="text-card-title">
        {t("trackingTitle")}
      </h2>
      <ol className="mt-4 flex flex-col">
        {steps(order, t).map((step, index, all) => (
          <li
            key={step.key}
            className="relative flex gap-3 pb-5 last:pb-0"
            aria-current={step.tone === "current" ? "step" : undefined}
          >
            {index < all.length - 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute start-[15px] top-8 bottom-0 w-0.5",
                  step.tone === "done" ? "bg-brand" : "bg-line",
                )}
              />
            )}
            <span
              aria-hidden="true"
              className={cn(
                "relative inline-flex size-8 flex-none items-center justify-center rounded-full",
                step.tone === "done" && "bg-brand text-on-brand",
                step.tone === "current" && "border-2 border-brand bg-surface text-brand",
                step.tone === "todo" && "border border-line-strong bg-surface text-faint",
                step.tone === "bad" && "bg-bad-bg text-bad-ink",
              )}
            >
              <Icon name={step.icon} className="size-4" />
            </span>
            <span className="pt-1">
              <b
                className={cn(
                  "block text-[14px]",
                  step.tone === "todo" && "font-medium text-muted",
                )}
              >
                {step.label}
              </b>
              <span className="text-[12px] text-muted">
                {step.date
                  ? format.dateTime(step.date, {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : step.tone === "current" || step.tone === "todo"
                    ? t("stepWaiting")
                    : null}
              </span>
            </span>
          </li>
        ))}
      </ol>

      {order.rejectReason && order.status === "REJECTED" && (
        <p className="mt-4 rounded-control bg-bad-bg px-3 py-2 text-[13px] text-bad-ink">
          {t("rejectedBecause", { reason: reasonLabel(order.rejectReason) })}
        </p>
      )}
      {order.cancelReason && order.status === "CANCELLED" && (
        <p className="mt-4 rounded-control bg-tile px-3 py-2 text-[13px] text-ink-2">
          {t("cancelledBecause", { reason: reasonLabel(order.cancelReason) })}
        </p>
      )}

      {/* On a phone the actions sit at the bottom of the screen instead. */}
      <div className="mt-5 flex flex-col gap-2 max-lg:hidden">
        <OrderActions order={order} />
      </div>
    </Card>
  );
}

// The one action that moves the order on (and refusing or cancelling it).
export function OrderActions({ order }: { order: OrderDetail }) {
  const t = useTranslations("orders");
  const transition = useOrderTransition(order.id);
  return (
    <>
      {order.status === "PENDING" && (
        <>
          <ConfirmDialog
            trigger={
              <Button variant="primary" size="lg" busy={transition.isPending}>
                {t("confirmPayment")}
              </Button>
            }
            title={t("confirmPaymentQuestion", { reference: order.reference })}
            description={t("confirmActionDescription")}
            cancelLabel={t("goBack")}
            confirmLabel={t("confirmPayment")}
            tone="primary"
            onConfirm={() => transition.mutate({ kind: "confirm" })}
          />
          <ReasonDialog
            kind="reject"
            busy={transition.isPending}
            onConfirm={(reason) => transition.mutate({ kind: "reject", reason })}
          />
          <p className="text-[12px] text-muted">{t("customerNotifiedHint")}</p>
        </>
      )}
      {order.status === "CONFIRMED" && (
        <ConfirmDialog
          trigger={
            <Button variant="primary" size="lg" busy={transition.isPending}>
              {t("markShipping")}
            </Button>
          }
          title={t("shipConfirmTitle")}
          description={t("shipConfirmBody")}
          cancelLabel={t("goBack")}
          confirmLabel={t("markShipping")}
          tone="primary"
          onConfirm={() => transition.mutate({ kind: "ship" })}
        />
      )}
      {order.status === "SHIPPING" && (
        <ConfirmDialog
          trigger={
            <Button variant="primary" size="lg" busy={transition.isPending}>
              {t("markDelivered")}
            </Button>
          }
          title={t("deliverConfirmTitle")}
          description={t("deliverConfirmBody")}
          cancelLabel={t("goBack")}
          confirmLabel={t("markDelivered")}
          tone="primary"
          onConfirm={() => transition.mutate({ kind: "deliver" })}
        />
      )}
      {(order.status === "CONFIRMED" || order.status === "SHIPPING") && (
        <ReasonDialog
          kind="cancel"
          busy={transition.isPending}
          onConfirm={(reason) => transition.mutate({ kind: "cancel", reason })}
        />
      )}
    </>
  );
}

// Phones: the actions fixed above the tab bar, always at thumb's reach.
export function MobileOrderActions({ order }: { order: OrderDetail }) {
  if (!["PENDING", "CONFIRMED", "SHIPPING"].includes(order.status)) return null;
  return (
    <div className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-20 flex flex-col gap-2 border-t border-line bg-surface px-4 py-3 md:bottom-0 lg:hidden print:hidden [&_p]:hidden">
      <OrderActions order={order} />
    </div>
  );
}

// Refusing a payment or cancelling an order: a reason is required, a
// preset (sent to the customer in their language) or the admin's own words.
function ReasonDialog({
  kind,
  busy,
  onConfirm,
}: {
  kind: "reject" | "cancel";
  busy: boolean;
  onConfirm: (reason: string) => void;
}) {
  const t = useTranslations("orders");
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<string>(
    kind === "reject" ? REJECT_REASON_PRESETS[0] : "other",
  );
  const [text, setText] = useState("");
  const reason = preset === "other" ? text.trim() : preset;

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="secondary" size="lg" className="text-bad-ink">
          {t(kind === "reject" ? "rejectOrderAction" : "cancelOrderAction")}
        </Button>
      }
      title={t(kind === "reject" ? "rejectDialogTitle" : "cancelActionConfirmTitle")}
      description={t(kind === "reject" ? "rejectDialogBody" : "cancelReasonHint")}
      closeLabel={t("goBack")}
      footer={
        <>
          <Button onClick={() => setOpen(false)}>{t("goBack")}</Button>
          <Button
            variant="danger"
            busy={busy}
            disabled={!reason}
            onClick={() => {
              onConfirm(reason);
              setOpen(false);
            }}
          >
            {t(kind === "reject" ? "confirmRejection" : "confirmCancellation")}
          </Button>
        </>
      }
    >
      {kind === "reject" && (
        <Field label={t("rejectReasonLabel")}>
          {(control) => (
            <Select {...control} value={preset} onChange={(event) => setPreset(event.target.value)}>
              {REJECT_REASON_PRESETS.map((value) => (
                <option key={value} value={value}>
                  {t(REASON_LABEL_KEY[value])}
                </option>
              ))}
              <option value="other">{t("reasonOther")}</option>
            </Select>
          )}
        </Field>
      )}
      {preset === "other" && (
        <Field label={t("cancelReasonLabel")}>
          {(control) => (
            <Textarea
              {...control}
              required
              maxLength={300}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={t(
                kind === "reject" ? "reasonOtherPlaceholder" : "cancelReasonPlaceholder",
              )}
            />
          )}
        </Field>
      )}
    </Dialog>
  );
}

// Who ordered, and how to reach them.
export function OrderCustomer({ order }: { order: OrderDetail }) {
  const t = useTranslations("orders");
  const initials = order.customer.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <Card as="section" aria-labelledby="customer-title" className="p-5">
      <h2 id="customer-title" className="text-card-title">
        {t("customerTitle")}
      </h2>
      <div className="mt-3 flex items-center gap-3">
        <span
          aria-hidden="true"
          className="inline-flex size-10 items-center justify-center rounded-full bg-tint font-bold text-brand"
        >
          {initials}
        </span>
        <span className="min-w-0">
          <b className="block truncate text-[15px]">{order.customer.name}</b>
          <span dir="ltr" className="text-[13px] text-muted">
            {order.customer.phone}
          </span>
        </span>
      </div>
      <dl className="mt-3">
        <KeyValue label={t("city")}>{order.customer.city}</KeyValue>
        <KeyValue label={t("ordersFromPhone")}>{order.customer.ordersFromPhone}</KeyValue>
      </dl>
    </Card>
  );
}
