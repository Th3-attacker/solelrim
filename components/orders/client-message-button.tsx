"use client";

import { ChatCircle } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  buildClientConfirmationMessage,
  buildClientRejectionMessage,
  buildClientWhatsAppLink,
} from "@/lib/shop/client-messages";

type Props =
  | {
      type: "confirmation";
      locale: string | null;
      customerName: string;
      customerPhone: string;
      reference: string;
      total: number;
    }
  | {
      type: "rejection";
      locale: string | null;
      customerName: string;
      customerPhone: string;
      reference: string;
      reason: string;
    };

export function ClientMessageButton(props: Props) {
  const t = useTranslations("orders");

  const message =
    props.type === "confirmation"
      ? buildClientConfirmationMessage({
          locale: props.locale,
          customerName: props.customerName,
          reference: props.reference,
          total: props.total,
        })
      : buildClientRejectionMessage({
          locale: props.locale,
          customerName: props.customerName,
          reference: props.reference,
          reason: props.reason,
        });

  const href = buildClientWhatsAppLink(props.customerPhone, message);

  return (
    <Button asChild variant="outline" size="sm">
      <a href={href} target="_blank" rel="noopener noreferrer">
        <ChatCircle className="size-4" />
        {props.type === "confirmation"
          ? t("sendConfirmationToClient")
          : t("sendRejectionToClient")}
      </a>
    </Button>
  );
}
