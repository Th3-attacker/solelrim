import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "use-intl";
import { notify } from "~/components/ui/toast";
import {
  cancelOrder,
  confirmOrder,
  deliverOrder,
  rejectOrder,
  shipOrder,
} from "./orders.functions";
import type { OrderStatus } from "./order-status";
import { orderQuery } from "./orders.queries";

type Transition =
  | { kind: "confirm" }
  | { kind: "ship" }
  | { kind: "deliver" }
  | { kind: "reject"; reason: string }
  | { kind: "cancel"; reason: string };

const NEXT_STATUS: Record<Transition["kind"], OrderStatus> = {
  confirm: "CONFIRMED",
  ship: "SHIPPING",
  deliver: "DELIVERED",
  reject: "REJECTED",
  cancel: "CANCELLED",
};

const TOAST = {
  confirm: "toastConfirmed",
  ship: "toastShipped",
  deliver: "toastDelivered",
  reject: "toastRejected",
  cancel: "toastCancelled",
} as const;

// Moving one order along: the page shows the new status at once, goes back
// if the server refuses, and every list, badge and count is read again.
export function useOrderTransition(orderId: string) {
  const t = useTranslations("orders");
  const queryClient = useQueryClient();
  const detail = orderQuery(orderId);

  return useMutation({
    mutationFn: async (transition: Transition) => {
      const result =
        transition.kind === "reject"
          ? await rejectOrder({ data: { orderId, reason: transition.reason } })
          : transition.kind === "cancel"
            ? await cancelOrder({ data: { orderId, reason: transition.reason } })
            : await { confirm: confirmOrder, ship: shipOrder, deliver: deliverOrder }[
                transition.kind
              ]({
                data: { orderId },
              });
      if ("error" in result) throw new TransitionRefused(result.error);
      return result;
    },
    onMutate: async (transition) => {
      await queryClient.cancelQueries({ queryKey: detail.queryKey });
      const before = queryClient.getQueryData(detail.queryKey);
      queryClient.setQueryData(detail.queryKey, (order) =>
        order ? { ...order, status: NEXT_STATUS[transition.kind] } : order,
      );
      return { before };
    },
    onError: (error, _transition, context) => {
      queryClient.setQueryData(detail.queryKey, context?.before);
      notify({
        tone: "error",
        title:
          error instanceof TransitionRefused && error.message !== "referenceCollision"
            ? t(error.message === "invalid" ? "reasonRequired" : "alreadyProcessed")
            : t("transitionFailed"),
      });
    },
    onSuccess: (_result, transition) => notify({ title: t(TOAST[transition.kind]) }),
    // The lists, the dashboard and the menu's badge all count orders.
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({ queryKey: ["shell"] }),
      ]),
  });
}

// The server said no for a reason it knows (already moved on, bad reason).
class TransitionRefused extends Error {}
