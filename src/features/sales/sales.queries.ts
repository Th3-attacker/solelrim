import { queryOptions } from "@tanstack/react-query";
import type { z } from "zod";
import {
  getSale,
  listRefunds,
  listMySales,
  listSales,
  type mySalesSearchSchema,
  type REFUND_FILTERS,
  type salesSearchSchema,
} from "./sales.functions";

// "sales" keys: a refund or a correction changes the sale and the lists;
// the till ("till") too, when cash goes back.
export const salesListQuery = (filters: z.infer<typeof salesSearchSchema>) =>
  queryOptions({
    queryKey: ["sales", "list", filters],
    queryFn: () => listSales({ data: filters }),
  });

export const saleQuery = (saleId: string) =>
  queryOptions({
    queryKey: ["sales", "detail", saleId],
    queryFn: () => getSale({ data: { saleId } }),
  });

export const refundsQuery = (status: (typeof REFUND_FILTERS)[number], page: number) =>
  queryOptions({
    queryKey: ["sales", "refunds", status, page],
    queryFn: () => listRefunds({ data: { status, page } }),
  });

export const mySalesQuery = (filters: z.infer<typeof mySalesSearchSchema>) =>
  queryOptions({
    queryKey: ["sales", "mine", filters],
    queryFn: () => listMySales({ data: filters }),
  });
