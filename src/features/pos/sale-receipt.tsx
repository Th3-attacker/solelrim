import { useState } from "react";
import { useFormatter, useLocale, useTranslations } from "use-intl";
import { resolveSiteName } from "@/lib/shop/localized-boutique-text";
import { normalizeLocalPhone } from "@/lib/shop/phone";
import {
  buildReceiptSummary,
  buildReceiptText,
  type ReceiptData,
  type ReceiptLabels,
} from "@/lib/shop/receipt";
import { buildClientWhatsAppLink } from "@/lib/shop/whatsapp-link";
import { Button } from "~/components/ui/button";
import { Field, Input } from "~/components/ui/field";
import { Icon } from "~/components/ui/icon";
import type { getSaleReceipt } from "./pos.functions";
import { useMoney } from "./till-parts";

type Receipt = NonNullable<Awaited<ReturnType<typeof getSaleReceipt>>>;

// The ticket, 72 mm wide (an 80 mm thermal roll's printable width; centered
// on A4), and the same content ready to send on WhatsApp. One model for both
// (lib/shop/receipt.ts), so they never disagree.
export function SaleReceipt({ receipt }: { receipt: Receipt }) {
  const t = useTranslations("pos");
  const tSales = useTranslations("sales");
  const locale = useLocale();
  const format = useFormatter();
  const money = useMoney();

  const paymentLabel =
    receipt.paymentMethod === "wallet"
      ? [t("wallet"), receipt.walletProvider].filter(Boolean).join(" · ")
      : receipt.paymentMethod === "cash"
        ? t("cash")
        : receipt.paymentMethod === "card" || receipt.paymentMethod === "transfer"
          ? tSales(receipt.paymentMethod)
          : "—";

  const data: ReceiptData = {
    boutiqueName: resolveSiteName(receipt.boutique, locale)?.trim() || receipt.boutique.label,
    reference: receipt.reference,
    date: format.dateTime(receipt.createdAt, { dateStyle: "short", timeStyle: "short" }),
    cancelled: receipt.status === "CANCELLED",
    lines: receipt.lines,
    subtotal: receipt.subtotal,
    discount: receipt.discount,
    loyaltyDiscount: receipt.loyaltyDiscount,
    loyaltyPointsEarned: receipt.loyaltyPointsEarned,
    total: receipt.total,
    paymentLabel,
    amountReceived: receipt.amountReceived,
  };
  const labels: ReceiptLabels = {
    reference: t("reference"),
    subtotal: t("subtotal"),
    discount: t("discount"),
    loyaltyDiscount: t("loyaltyReward"),
    loyaltyPoints: t("loyaltyPointsEarned"),
    total: t("total"),
    payment: t("paymentMethod"),
    amountReceived: t("amountReceived"),
    change: t("change"),
    cancelled: t("receiptCancelled"),
    thanks: t("receiptThanks"),
  };

  return (
    <div className="flex flex-col gap-5">
      <style>{`@media print { @page { margin: 4mm; } body { background: #fff; } }`}</style>
      <article
        aria-label={t("receipt")}
        className="mx-auto flex w-[72mm] max-w-full flex-col gap-3 rounded-control border border-line bg-white p-4 font-mono text-[12px] leading-relaxed text-black print:border-0 print:p-0"
      >
        <header className="flex flex-col items-center gap-1 text-center">
          {receipt.boutique.logoUrl && (
            <img src={receipt.boutique.logoUrl} alt="" className="size-12 object-contain" />
          )}
          <p className="font-sans text-[14px] font-bold">{data.boutiqueName}</p>
          {receipt.boutique.adminWhatsappNumber && (
            <p dir="ltr">{receipt.boutique.adminWhatsappNumber}</p>
          )}
        </header>
        {data.cancelled && (
          <p className="border border-current py-1 text-center font-bold uppercase">
            {labels.cancelled}
          </p>
        )}
        <dl className="flex flex-col gap-0.5 border-y border-dashed border-black py-2">
          <div className="flex justify-between gap-2">
            <dt>{labels.reference}</dt>
            <dd dir="ltr">{data.reference}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>{t("receiptDate")}</dt>
            <dd>{data.date}</dd>
          </div>
          {receipt.sellerLabel && (
            <div className="flex justify-between gap-2">
              <dt>{t("receiptSeller")}</dt>
              <dd>{receipt.sellerLabel}</dd>
            </div>
          )}
        </dl>
        <ul className="flex flex-col gap-1.5">
          {receipt.lines.map((line, index) => (
            <li key={index} className="flex flex-col">
              <span className="font-sans font-semibold">{line.productName}</span>
              <span className="flex justify-between gap-2 tabular-nums">
                <span>
                  {line.size} · {line.color} · {line.quantity} × {money(line.unitPrice)}
                </span>
                <span>{money(line.lineTotal)}</span>
              </span>
            </li>
          ))}
        </ul>
        <dl className="flex flex-col gap-0.5 border-t border-dashed border-black pt-2 tabular-nums">
          {buildReceiptSummary(data, money).map((row) => (
            <div
              key={row.key}
              className={
                row.emphasis ? "flex justify-between text-[14px] font-bold" : "flex justify-between"
              }
            >
              <dt>{labels[row.key]}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
        <p className="border-t border-dashed border-black pt-2 text-center font-sans">
          {labels.thanks}
        </p>
      </article>

      {/* Nothing to send for a voided sale; the printed copy still says so. */}
      {!data.cancelled && (
        <WhatsAppReceipt
          message={buildReceiptText(data, labels, money)}
          defaultPhone={receipt.clientPhone ?? ""}
        />
      )}
    </div>
  );
}

// Opens WhatsApp on the seller's device with the receipt written; they press
// send themselves. Pre-filled with the loyalty card's number, if any.
function WhatsAppReceipt({ message, defaultPhone }: { message: string; defaultPhone: string }) {
  const t = useTranslations("pos");
  const [phone, setPhone] = useState(defaultPhone);
  const local = normalizeLocalPhone(phone);
  return (
    <section
      aria-label={t("receiptPhone")}
      className="mx-auto flex w-full max-w-md flex-col gap-2 rounded-card border border-line bg-surface p-4 print:hidden"
    >
      <div className="flex items-end gap-2">
        <Field label={t("receiptPhone")} hint={t("receiptPhoneHint")} className="flex-1">
          {(control) => (
            <Input
              {...control}
              type="tel"
              inputMode="tel"
              dir="ltr"
              autoComplete="off"
              placeholder="22 12 34 56"
              value={phone}
              aria-invalid={phone.length > 0 && local === null ? true : undefined}
              onChange={(event) => setPhone(event.target.value)}
            />
          )}
        </Field>
      </div>
      {local ? (
        <a
          href={buildClientWhatsAppLink(local, message)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-control border border-line-strong bg-surface px-3.5 text-[14px] font-semibold text-ink no-underline hover:bg-surface-2 hover:text-ink"
        >
          <Icon name="chat" />
          {t("sendWhatsApp")}
        </a>
      ) : (
        <Button disabled className="self-start">
          <Icon name="chat" />
          {t("sendWhatsApp")}
        </Button>
      )}
    </section>
  );
}
