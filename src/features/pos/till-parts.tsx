import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "use-intl";
import { formatPriceNumber } from "@/lib/format/currency";
import { cashDifference, type BreakdownRow, type SessionTotals } from "@/lib/shop/cash";
import { cn } from "~/lib/cn";
import { Button } from "~/components/ui/button";
import { ConfirmDialog } from "~/components/ui/dialog";
import { Field, Input, Segmented, Textarea } from "~/components/ui/field";
import { Icon } from "~/components/ui/icon";
import { Status } from "~/components/ui/status";
import { notify } from "~/components/ui/toast";
import { addTillMovement, closeTill, openTill } from "./till.functions";
import { useCommandError } from "./use-command-error";

export function useMoney() {
  const currency = useTranslations("common")("currency");
  return (value: number) => `${formatPriceNumber(value)} ${currency}`;
}

// A typed amount: digits, a dot or a comma for cents. Empty means not given.
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/\s/g, "").replace(",", ".");
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

// Every till write changes what the checkout, the till pages and the
// dashboard show.
function useTillInvalidation() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["till"] }),
      queryClient.invalidateQueries({ queryKey: ["orders", "dashboard"] }),
    ]);
}

// The first screen of the day: the float counted in the drawer.
export function OpenTill({
  lastClosed,
}: {
  lastClosed: {
    closedAt: Date | null;
    countedCash: number | null;
    cashDifference: number | null;
  } | null;
}) {
  const t = useTranslations("cash");
  const format = useFormatter();
  const money = useMoney();
  const showError = useCommandError("cash.error");
  const invalidate = useTillInvalidation();
  const [text, setText] = useState("");
  const [confirming, setConfirming] = useState(false);
  const amount = parseAmount(text);

  const open = useMutation({
    mutationFn: () => openTill({ data: { openingFloat: amount ?? 0 } }),
    onSuccess: async (result) => {
      if (result.error) return showError(result.error);
      await invalidate();
    },
    onError: showError,
  });

  return (
    <section
      aria-labelledby="open-till-title"
      className="mx-auto w-full max-w-[560px] overflow-hidden rounded-dialog border border-line bg-surface shadow-[0_10px_30px_rgb(15_23_42/0.06)]"
    >
      <div className="flex items-start gap-4 px-7 pt-7 pb-5">
        <span className="inline-flex size-12 flex-none items-center justify-center rounded-xl bg-brand text-on-brand">
          <Icon name="pos" className="size-6" />
        </span>
        <div>
          <h1
            id="open-till-title"
            className="text-[24px] leading-[30px] font-bold tracking-[-0.4px]"
          >
            {t("openTitle")}
          </h1>
          <p className="mt-1.5 text-[14px] text-muted">
            {t("openHint")}
            {lastClosed?.closedAt && lastClosed.countedCash !== null && (
              <>
                {" "}
                {t("lastClosedSummary", {
                  date: format.dateTime(lastClosed.closedAt, {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                  counted: money(lastClosed.countedCash),
                  difference: money(lastClosed.cashDifference ?? 0),
                })}
              </>
            )}
          </p>
        </div>
      </div>
      <form
        method="post"
        noValidate
        className="flex flex-col gap-4 px-7 pb-7"
        onSubmit={(event) => {
          event.preventDefault();
          if (amount !== null) setConfirming(true);
        }}
      >
        <Field label={t("openingFloatLabel")} hint={t("openingFloatHint")}>
          {(control) => (
            <Input
              {...control}
              inputMode="decimal"
              dir="ltr"
              autoFocus
              placeholder="0"
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="h-[60px] text-end text-[28px] font-bold tracking-[-0.5px] text-brand"
            />
          )}
        </Field>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          busy={open.isPending}
          disabled={amount === null}
        >
          {t("openAction")}
        </Button>
      </form>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("openConfirmTitle")}
        description={t("openConfirmBody", { amount: money(amount ?? 0) })}
        cancelLabel={t("goBack")}
        confirmLabel={t("openAction")}
        tone="primary"
        onConfirm={() => open.mutate()}
      />
    </section>
  );
}

function methodLabel(row: BreakdownRow, t: ReturnType<typeof useTranslations<"cash">>) {
  if (row.method === "cash") return t("methodCash");
  if (row.method === "wallet") return row.provider ?? t("methodWallet");
  return t("methodOther");
}

// A till's figures (or a whole day's): float, takings per payment method,
// movements, and the cash that should be in the drawer.
export function TillTotals({ totals }: { totals: SessionTotals }) {
  const t = useTranslations("cash");
  const money = useMoney();
  const row = "flex justify-between gap-3 py-1.5 text-[14px] tabular-nums";
  return (
    <dl>
      <div className={row}>
        <dt className="text-muted">{t("openingFloat")}</dt>
        <dd>{money(totals.openingFloat)}</dd>
      </div>
      <div className="my-1 border-t border-dashed border-line" />
      {totals.breakdown.map((line) => (
        <div
          key={`${line.method}:${line.provider ?? ""}`}
          className={cn(row, line.count === 0 && "text-faint")}
        >
          <dt>
            {methodLabel(line, t)} <span className="text-muted">({line.count})</span>
          </dt>
          <dd>{money(line.total)}</dd>
        </div>
      ))}
      <div className={cn(row, "font-semibold")}>
        <dt>{t("salesTotal")}</dt>
        <dd>{money(totals.salesTotal)}</dd>
      </div>
      <div className="my-1 border-t border-dashed border-line" />
      <div className={row}>
        <dt className="text-muted">{t("cashIn")}</dt>
        <dd>+{money(totals.cashIn)}</dd>
      </div>
      <div className={row}>
        <dt className="text-muted">{t("cashOut")}</dt>
        <dd>−{money(totals.cashOut)}</dd>
      </div>
      {(totals.cashRefunds ?? 0) > 0 && (
        <div className={row}>
          <dt className="text-muted">{t("cashRefunds")}</dt>
          <dd>−{money(totals.cashRefunds ?? 0)}</dd>
        </div>
      )}
      <div className={cn(row, "mt-1 border-t border-line pt-2.5 text-[16px] font-bold")}>
        <dt>{t("expectedCash")}</dt>
        <dd className="text-brand">{money(totals.expectedCash)}</dd>
      </div>
    </dl>
  );
}

// Positive: more cash than expected. Negative: some is missing.
export function DifferenceStatus({ difference }: { difference: number | null }) {
  const t = useTranslations("cash");
  const money = useMoney();
  if (difference === null) return <Status tone="pend">{t("notCounted")}</Status>;
  if (difference === 0) return <Status tone="ok">{t("differenceNone")}</Status>;
  return (
    <Status tone={difference < 0 ? "bad" : "warn"}>
      {t(difference < 0 ? "differenceShort" : "differenceOver", {
        amount: money(Math.abs(difference)),
      })}
    </Status>
  );
}

// Cash put into the drawer or taken out of it, always with a reason.
export function MovementForm() {
  const t = useTranslations("cash");
  const money = useMoney();
  const showError = useCommandError("cash.error");
  const invalidate = useTillInvalidation();
  const [type, setType] = useState<"IN" | "OUT">("IN");
  const [text, setText] = useState("");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const amount = parseAmount(text);
  const valid = amount !== null && amount > 0 && reason.trim().length >= 3;

  const add = useMutation({
    mutationFn: () => addTillMovement({ data: { type, amount, reason: reason.trim() } }),
    onSuccess: async (result) => {
      if (result.error) return showError(result.error);
      notify({ title: t(type === "IN" ? "movementInSaved" : "movementOutSaved") });
      setText("");
      setReason("");
      await invalidate();
    },
    onError: showError,
  });

  return (
    <form
      method="post"
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) setConfirming(true);
      }}
    >
      <Segmented
        label={t("movementsTitle")}
        name="movement-type"
        value={type}
        onChange={setType}
        options={[
          { value: "IN", label: t("cashIn") },
          { value: "OUT", label: t("cashOut") },
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
        <Field label={t("amount")}>
          {(control) => (
            <Input
              {...control}
              inputMode="decimal"
              dir="ltr"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          )}
        </Field>
        <Field label={t("reason")}>
          {(control) => (
            <Input
              {...control}
              maxLength={200}
              value={reason}
              placeholder={t(type === "IN" ? "reasonInPlaceholder" : "reasonOutPlaceholder")}
              onChange={(event) => setReason(event.target.value)}
            />
          )}
        </Field>
      </div>
      <Button type="submit" className="self-start" busy={add.isPending} disabled={!valid}>
        {t("addMovement")}
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t(type === "IN" ? "movementInConfirmTitle" : "movementOutConfirmTitle")}
        description={t("movementConfirmBody", {
          amount: money(amount ?? 0),
          reason: reason.trim(),
        })}
        cancelLabel={t("goBack")}
        confirmLabel={t("addMovement")}
        tone="primary"
        onConfirm={() => add.mutate()}
      />
    </form>
  );
}

// Closing a till against the cash counted. The difference shown is a
// preview: the server recomputes what was expected when it closes.
export function CloseTillForm({
  sessionId,
  expectedCash,
  onClosed,
}: {
  sessionId: string;
  expectedCash: number;
  onClosed: () => void;
}) {
  const t = useTranslations("cash");
  const money = useMoney();
  const showError = useCommandError("cash.error");
  const invalidate = useTillInvalidation();
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const counted = parseAmount(text);
  const difference = counted === null ? null : cashDifference(counted, expectedCash);
  const noteMissing = difference !== null && difference !== 0 && !note.trim();
  const valid = counted !== null && !noteMissing;

  const close = useMutation({
    mutationFn: () => closeTill({ data: { sessionId, countedCash: counted, note: note.trim() } }),
    onSuccess: async (result) => {
      if (result.error) return showError(result.error);
      notify({ title: t("closed") });
      await invalidate();
      onClosed();
    },
    onError: showError,
  });

  const differenceText =
    difference === null || difference === 0
      ? t("differenceNone")
      : t(difference < 0 ? "differenceShort" : "differenceOver", {
          amount: money(Math.abs(difference)),
        });

  return (
    <form
      method="post"
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) setConfirming(true);
      }}
    >
      <Field label={t("countedCash")} hint={t("expectedCashHint", { amount: money(expectedCash) })}>
        {(control) => (
          <Input
            {...control}
            inputMode="decimal"
            dir="ltr"
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="h-12 text-end text-[20px] font-bold"
          />
        )}
      </Field>
      {difference !== null && <DifferenceStatus difference={difference} />}
      <Field
        label={t("closingNote")}
        error={noteMissing ? t("noteRequiredHint") : undefined}
        required={noteMissing}
      >
        {(control) => (
          <Textarea
            {...control}
            maxLength={500}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        )}
      </Field>
      <Button type="submit" variant="primary" size="lg" busy={close.isPending} disabled={!valid}>
        {t("closeAction")}
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("closeConfirmTitle")}
        description={t("closeConfirmBody", {
          counted: money(counted ?? 0),
          difference: differenceText,
        })}
        cancelLabel={t("goBack")}
        confirmLabel={t("closeAction")}
        onConfirm={() => close.mutate()}
      />
    </form>
  );
}
