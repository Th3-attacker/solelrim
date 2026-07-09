import { CreditCard, MessageCircle, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";

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
    <div className="grid gap-4 rounded-2xl border bg-muted/30 p-6 sm:grid-cols-3 sm:p-8">
      {items.map((item) => (
        <div key={item.title} className="flex items-start gap-3">
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
  );
}
