"use client";

import { Check } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const STEPS = [1, 2, 3] as const;

export function CheckoutStepper({ current }: { current: 1 | 2 | 3 }) {
  const t = useTranslations("checkout");
  const labels = { 1: t("step1Title"), 2: t("step2Title"), 3: t("step3Title") };

  return (
    <nav aria-label={t("title")} className="flex items-center">
      {STEPS.map((n, index) => {
        const done = n < current;
        const active = n === current;
        return (
          <div key={n} className="flex flex-1 items-center last:flex-none">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary bg-primary/10 text-primary",
                  !done && !active && "border-border text-muted-foreground",
                )}
              >
                {done ? <Check className="size-4" /> : n}
              </div>
              <div className="hidden flex-col sm:flex">
                <span className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
                  {t("stepCounter", { current: n })}
                </span>
                <span
                  className={cn(
                    "text-sm font-medium",
                    active || done ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {labels[n]}
                </span>
              </div>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-3 h-px flex-1 transition-colors sm:mx-4",
                  done ? "bg-primary" : "bg-border",
                )}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
