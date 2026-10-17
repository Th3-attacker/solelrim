import { queryOptions } from "@tanstack/react-query";
import { getCheckout, getSaleReceipt } from "./pos.functions";
import { getClosures, getMyTill, getTill, listTills } from "./till.functions";

// "till" keys: anything a sale, a movement or a closing changes. A sale
// also changes stock and figures: the checkout invalidates "orders" (the
// dashboard) too.
export const checkoutQuery = queryOptions({
  queryKey: ["till", "checkout"],
  queryFn: () => getCheckout(),
});

export const myTillQuery = queryOptions({
  queryKey: ["till", "mine"],
  queryFn: () => getMyTill(),
});

export const tillQuery = (sessionId: string) =>
  queryOptions({
    queryKey: ["till", "session", sessionId],
    queryFn: () => getTill({ data: { sessionId } }),
  });

export const tillsQuery = (page: number) =>
  queryOptions({
    queryKey: ["till", "list", page],
    queryFn: () => listTills({ data: { page } }),
  });

export const closuresQuery = (date: string | undefined) =>
  queryOptions({
    queryKey: ["till", "closures", date ?? "today"],
    queryFn: () => getClosures({ data: { date } }),
  });

export const receiptQuery = (saleId: string) =>
  queryOptions({
    queryKey: ["sales", "receipt", saleId],
    queryFn: () => getSaleReceipt({ data: { saleId } }),
  });
