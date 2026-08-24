"use client";

import { ChatCircle } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  buildClientConfirmationMessage,
  buildClientRejectionMessage,
  buildClientShippedMessage,
  buildClientDeliveredMessage,
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
    }
  | {
      type: "shipped" | "delivered";
      locale: string | null;
      customerName: string;
      customerPhone: string;
      reference: string;
    };

const LABEL_KEY = {
  confirmation: "sendConfirmationToClient",
  rejection: "sendRejectionToClient",
  shipped: "sendShippedToClient",
  delivered: "sendDeliveredToClient",
} as const;

export function ClientMessageButton(props: Props) {
  const t = useTranslations("orders");

  let message: string;
  switch (props.type) {
    case "confirmation":
      message = buildClientConfirmationMessage({
        locale: props.locale,
        customerName: props.customerName,
        reference: props.reference,
        total: props.total,
      });
      break;
    case "rejection":
      message = buildClientRejectionMessage({
        locale: props.locale,
        customerName: props.customerName,
        reference: props.reference,
        reason: props.reason,
      });
      break;
    case "shipped":
      message = buildClientShippedMessage({
        locale: props.locale,
        customerName: props.customerName,
        reference: props.reference,
      });
      break;
    case "delivered":
      message = buildClientDeliveredMessage({
        locale: props.locale,
        customerName: props.customerName,
        reference: props.reference,
      });
      break;
  }

  const href = buildClientWhatsAppLink(props.customerPhone, message);

  return (
    <Button asChild variant="outline" size="sm">
      <a href={href} target="_blank" rel="noopener noreferrer">
        <ChatCircle className="size-4" />
        {t(LABEL_KEY[props.type])}
      </a>
    </Button>
  );
}
