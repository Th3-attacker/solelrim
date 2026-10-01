"use client";

import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast";

const KNOWN_ERRORS = new Set([
  "invalid",
  "alreadyOpen",
  "dayClosed",
  "noOpenSession",
  "insufficientCash",
  "alreadyClosed",
  "notFound",
  "noteRequired",
  "noSessions",
  "openSessions",
  "unauthorized",
  "licenseBlocked",
]);

export function useCashError() {
  const t = useTranslations("cash");
  const tCommon = useTranslations("common");
  return (error: string): void => {
    toast.error(KNOWN_ERRORS.has(error) ? t(`error.${error}`) : tCommon("error"));
  };
}
