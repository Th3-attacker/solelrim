import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PrintInvoiceButton } from "@/components/sales/print-invoice-button";
import { WhatsAppReceiptForm } from "@/components/pos/whatsapp-receipt-form";
import { requireCheckoutScope } from "@/lib/shop/admin-scope";
import { getReceipt } from "@/lib/queries/pos";
import { formatPrice } from "@/lib/format/currency";
import { resolveSiteName } from "@/lib/shop/localized-boutique-text";
import { buildReceiptText } from "@/lib/shop/receipt";

const LEGACY_PAYMENT_METHODS = new Set(["card", "transfer"]);

// Under /admin/pos, so a seller can reach it (proxy.ts). Scoped through
// requireCheckoutScope + getReceipt, so another boutique's sale id is a 404.
export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ saleId: string }>;
}) {
  const { saleId } = await params;
  const { productType } = await requireCheckoutScope();
  const [receipt, t, tSales, tCommon, format, locale] = await Promise.all([
    getReceipt(saleId, productType),
    getTranslations("pos"),
    getTranslations("sales"),
    getTranslations("common"),
    getFormatter(),
    getLocale(),
  ]);
  if (!receipt) {
    notFound();
  }

  const currency = tCommon("currency");
  const money = (amount: number) => formatPrice(amount, currency);
  const boutiqueName = resolveSiteName(receipt.boutique, locale)?.trim() || receipt.boutique.label;
  const date = format.dateTime(receipt.createdAt, { dateStyle: "short", timeStyle: "short" });
  const paymentLabel =
    receipt.paymentMethod === "wallet"
      ? `${t("wallet")} · ${receipt.walletProvider ?? ""}`.trim()
      : receipt.paymentMethod === "cash"
        ? t("cash")
        : receipt.paymentMethod && LEGACY_PAYMENT_METHODS.has(receipt.paymentMethod)
          ? tSales(receipt.paymentMethod as "card" | "transfer")
          : "—";

  const whatsappMessage = buildReceiptText(
    { ...receipt, boutiqueName, date, paymentLabel },
    {
      reference: t("reference"),
      subtotal: t("subtotal"),
      discount: t("discount"),
      total: t("total"),
      payment: t("paymentMethod"),
      amountReceived: t("amountReceived"),
      change: t("change"),
      thanks: t("receiptThanks"),
    },
    money,
  );

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 print:max-w-full">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button asChild variant="ghost">
          <Link href="/admin/pos">
            <ArrowLeft className="size-4 rtl:rotate-180" />
            {t("backToCheckout")}
          </Link>
        </Button>
        <PrintInvoiceButton />
      </div>

      {/* 72mm is the printable width of standard 80mm thermal paper; on an
          A4 printer the same column simply prints centered. */}
      <article className="mx-auto flex w-[72mm] max-w-full flex-col gap-3 rounded-md border bg-card p-4 font-mono text-xs leading-relaxed print:border-0 print:p-0">
        <header className="flex flex-col items-center gap-1 text-center">
          {receipt.boutique.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={receipt.boutique.logoUrl} alt="" className="size-12 object-contain" />
          )}
          <p className="font-sans text-sm font-bold">{boutiqueName}</p>
          {receipt.boutique.adminWhatsappNumber && (
            <p dir="ltr">{receipt.boutique.adminWhatsappNumber}</p>
          )}
        </header>

        {receipt.status === "CANCELLED" && (
          <p className="border border-current py-1 text-center font-bold uppercase">
            {t("receiptCancelled")}
          </p>
        )}

        <dl className="flex flex-col gap-0.5 border-y border-dashed py-2">
          <div className="flex justify-between gap-2">
            <dt>{t("reference")}</dt>
            <dd>{receipt.reference}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>{t("receiptDate")}</dt>
            <dd>{date}</dd>
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
              <span className="font-sans font-medium">{line.productName}</span>
              <span className="flex justify-between gap-2 tabular-nums">
                <span>
                  {line.size} · {line.color} · {line.quantity} × {money(line.unitPrice)}
                </span>
                <span>{money(line.lineTotal)}</span>
              </span>
            </li>
          ))}
        </ul>

        <dl className="flex flex-col gap-0.5 border-t border-dashed pt-2 tabular-nums">
          {receipt.discount > 0 && (
            <>
              <div className="flex justify-between">
                <dt>{t("subtotal")}</dt>
                <dd>{money(receipt.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>{t("discount")}</dt>
                <dd>−{money(receipt.discount)}</dd>
              </div>
            </>
          )}
          <div className="flex justify-between text-sm font-bold">
            <dt>{t("total")}</dt>
            <dd>{money(receipt.total)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>{t("paymentMethod")}</dt>
            <dd>{paymentLabel}</dd>
          </div>
          {receipt.amountReceived !== null && (
            <>
              <div className="flex justify-between">
                <dt>{t("amountReceived")}</dt>
                <dd>{money(receipt.amountReceived)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>{t("change")}</dt>
                <dd>{money(receipt.amountReceived - receipt.total)}</dd>
              </div>
            </>
          )}
        </dl>

        <p className="border-t border-dashed pt-2 text-center font-sans">{t("receiptThanks")}</p>
      </article>

      <div className="rounded-md border p-4 print:hidden">
        <WhatsAppReceiptForm message={whatsappMessage} />
      </div>
    </div>
  );
}
