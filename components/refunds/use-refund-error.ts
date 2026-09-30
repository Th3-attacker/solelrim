"use client";

import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast";

const KNOWN_ERRORS = new Set([
  "invalid",
  "invalidQuantity",
  "notFound",
  "notRefundable",
  "alreadyPending",
  "alreadyDecided",
  "noOpenSession",
  "insufficientCash",
  "unauthorized",
  "licenseBlocked",
]);

export function useRefundError() {
  const t = useTranslations("refunds");
  const tCommon = useTranslations("common");
  return (error: string): void => {
    toast.error(KNOWN_ERRORS.has(error) ? t(`error.${error}`) : tCommon("error"));
  };
}
