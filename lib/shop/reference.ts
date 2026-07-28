import { format } from "date-fns";

export function buildOrderReference(): string {
  const datePart = format(new Date(), "yyyyMMdd");
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `CMD-${datePart}-${randomPart}`;
}

export function buildSaleReference(): string {
  const datePart = format(new Date(), "yyyyMMdd");
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `INV-${datePart}-${randomPart}`;
}
