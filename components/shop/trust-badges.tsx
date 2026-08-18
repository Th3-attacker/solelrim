import { CreditCard, MessageCircle, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { OrderProcedureTrigger } from "@/components/shop/order-procedure-trigger";
import { SectionTitle } from "@/components/shop/section-title";

export async function TrustBadges() {
  const t = await getTranslations("shop");

  const items = [
    {
      icon: CreditCard,
      title: t("trustPaymentTitle"),
      desc: t("trustPaymentDesc"),
    },
    {
      icon: MessageCircle,
      title: t("trustWhatsappTitle"),
      desc: t("trustWhatsappDesc"),
    },
    {
      icon: ShieldCheck,
      title: t("trustReviewTitle"),
      desc: t("trustReviewDesc"),
    },
  ];

  return (
    <div className="flex flex-col items-center gap-6">
      <SectionTitle>{t("trustSectionTitle")}</SectionTitle>
      <div className="grid w-full gap-3 desktop:gap-4 rounded-2xl border bg-muted/30 p-6 sm:grid-cols-3 sm:p-8">
        {items.map((item, index) => (
          <div
            key={item.title}
            style={{ animationDelay: `${index * 90}ms` }}
            className="animate-in fade-in slide-in-from-bottom-4 flex items-start gap-3 duration-700 ease-out"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <item.icon className="size-5" />
            </div>
            <div>
              <p className="text-sm font-medium">{item.title}</p>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <OrderProcedureTrigger />
    </div>
  );
}
