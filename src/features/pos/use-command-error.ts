import { useTranslations } from "use-intl";
import { expectedErrorCode } from "@/lib/errors";
import { notify } from "~/components/ui/toast";

// A refusal the till or the checkout knows ("dayClosed", "insufficientStock",
// a suspended boutique…) reads as its own message; anything else as a plain
// error. Returned refusals and thrown ones (the gate) end up here alike.
export function useCommandError(
  namespace: "pos.error" | "cash.error" | "refunds.error" | "sales.cancelError" | "saleEdit.error",
) {
  const t = useTranslations(namespace);
  const tCommon = useTranslations("common");
  return (error: unknown) => {
    const code =
      typeof error === "string"
        ? error
        : (expectedErrorCode(error) ?? (error instanceof Error ? error.message : ""));
    notify({
      tone: "error",
      title: t.has(code as "invalid") ? t(code as "invalid") : tCommon("error"),
    });
  };
}
