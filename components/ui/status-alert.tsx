import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  CheckCircle,
  InfoIcon,
  Warning,
  XCircle,
} from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/utils";

// One look for every inline message about the outcome of something: the
// same four colors as the toasts and badges (--success / --warning /
// --destructive / --info), always paired with an icon so the meaning never
// rests on color alone. The text is darkened in light mode (and lightened in
// dark mode) from the same token — the raw tokens alone don't reach 4.5:1
// on their own pale tint.
const statusAlertVariants = cva(
  "flex w-full items-start gap-2.5 rounded-lg border p-3 text-start text-sm leading-snug [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        success:
          "border-success/30 bg-success/10 text-[color-mix(in_oklch,var(--success),black_40%)] dark:border-success/40 dark:bg-success/15 dark:text-[color-mix(in_oklch,var(--success),white_20%)]",
        warning:
          "border-warning/35 bg-warning/10 text-[color-mix(in_oklch,var(--warning),black_45%)] dark:border-warning/40 dark:bg-warning/15 dark:text-[color-mix(in_oklch,var(--warning),white_20%)]",
        error:
          "border-destructive/30 bg-destructive/10 text-[color-mix(in_oklch,var(--destructive),black_35%)] dark:border-destructive/40 dark:bg-destructive/15 dark:text-[color-mix(in_oklch,var(--destructive),white_20%)]",
        info:
          "border-info/30 bg-info/10 text-[color-mix(in_oklch,var(--info),black_35%)] dark:border-info/40 dark:bg-info/15 dark:text-[color-mix(in_oklch,var(--info),white_20%)]",
      },
    },
    defaultVariants: { variant: "info" },
  },
);

type StatusAlertVariant = NonNullable<
  VariantProps<typeof statusAlertVariants>["variant"]
>;

const ICONS: Record<StatusAlertVariant, React.ElementType> = {
  success: CheckCircle,
  warning: Warning,
  error: XCircle,
  info: InfoIcon,
};

// Errors interrupt (role="alert"); the rest are announced politely.
function StatusAlert({
  variant = "info",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof statusAlertVariants>) {
  const Icon = ICONS[variant ?? "info"];
  return (
    <div
      data-slot="status-alert"
      role={variant === "error" ? "alert" : "status"}
      className={cn(statusAlertVariants({ variant }), className)}
      {...props}
    >
      <Icon weight="fill" aria-hidden="true" />
      <div className="min-w-0 flex-1 break-words">{children}</div>
    </div>
  );
}

export { StatusAlert, statusAlertVariants };
