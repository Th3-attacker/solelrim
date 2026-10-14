import { useFormatter, useTranslations } from "use-intl";
import { Button } from "~/components/ui/button";
import { Icon } from "~/components/ui/icon";
import { useMoney } from "./order-detail";
import type { getOrderLabels } from "./orders.functions";

type Labels = Awaited<ReturnType<typeof getOrderLabels>>;

// 10 × 15 cm, black on white, one per printed page: what the delivery
// person needs to read at arm's length, nothing else.
export function DeliveryLabels({ data }: { data: Labels }) {
  const t = useTranslations("orders");
  const format = useFormatter();
  const money = useMoney();

  return (
    <div className="flex flex-col items-center gap-5 px-4 py-7 print:block print:p-0">
      {/* The label printer's sheet, and nothing of the admin around it. */}
      <style>{`@media print { @page { size: 10cm 15cm; margin: 0; } body { background: #fff; } }`}</style>
      <div className="flex w-full max-w-[10cm] items-center justify-between gap-3 print:hidden">
        <h1 className="text-card-title">{t("labelsCount", { count: data.orders.length })}</h1>
        <Button variant="primary" onClick={() => window.print()}>
          <Icon name="print" />
          {t("printLabels")}
        </Button>
      </div>

      {data.orders.map((order) => (
        <article
          key={order.id}
          aria-label={`${t("labelOrder")} ${order.reference}`}
          className="flex h-[15cm] w-[10cm] flex-col gap-4 border-2 border-black bg-white p-5 text-black [break-after:page] print:border-0"
        >
          <header className="flex items-center justify-between">
            <img src="/brand/solal-logo-black.svg" alt="SOLAL" className="h-7 w-auto" />
            <div className="text-end">
              <p className="text-[9px] font-bold tracking-[1.5px]">{t("labelDelivery")}</p>
              <p className="text-[11px]">{format.dateTime(order.date, { dateStyle: "long" })}</p>
            </div>
          </header>
          <div className="border-t-[3px] border-black pt-3">
            <p className="text-[9px] font-bold tracking-[1.5px]">{t("labelOrder")}</p>
            <p
              dir="ltr"
              className="text-[26px] leading-8 font-extrabold tracking-[0.5px] break-all"
            >
              {order.reference}
            </p>
          </div>
          <div>
            <p className="text-[9px] font-bold tracking-[1.5px]">{t("labelRecipient")}</p>
            <p className="text-[20px] leading-6 font-bold">{order.customerName}</p>
            <p dir="ltr" className="text-[17px] font-semibold">
              {order.customerPhone}
            </p>
            <p className="mt-1 text-[14px]">{order.customerCity}</p>
          </div>
          <div className="grid grid-cols-2 border-2 border-black">
            <div className="border-e-2 border-black p-2.5">
              <p className="text-[9px] font-bold tracking-[1.5px]">{t("labelItems")}</p>
              <p className="text-[20px] font-extrabold">{order.itemCount}</p>
            </div>
            <div className="p-2.5">
              <p className="text-[9px] font-bold tracking-[1.5px]">{t("labelPayment")}</p>
              <p className="text-[13px] font-extrabold">{t("labelPaidMobile")}</p>
              <p className="text-[12px]">{money(order.total)}</p>
            </div>
          </div>
          <p className="text-[11px]">{t("labelReminder")}</p>
          <footer className="mt-auto flex justify-between gap-2 border-t-2 border-black pt-2 text-[11px]">
            <span>
              <b>{t("labelSender")}</b> {data.sender.name}
            </span>
            {data.sender.whatsapp && <span dir="ltr">WhatsApp {data.sender.whatsapp}</span>}
          </footer>
        </article>
      ))}
    </div>
  );
}
