import { forwardRef, type ButtonHTMLAttributes, type AnchorHTMLAttributes } from "react";
import { createLink } from "@tanstack/react-router";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "~/lib/cn";

// The design's buttons: one primary (marine) per screen, secondary with a
// border, quiet (text only), and danger for the verb of a definitive action.
// Heights: 40 by default, 48 in forms and the checkout, 32 in tables.
export const buttonVariants = cva(
  "inline-flex flex-none items-center justify-center gap-2 rounded-control font-semibold whitespace-nowrap no-underline transition-colors disabled:pointer-events-none disabled:opacity-55 aria-disabled:pointer-events-none aria-disabled:opacity-55",
  {
    variants: {
      variant: {
        primary:
          "bg-brand text-on-brand shadow-[0_1px_2px_rgb(15_23_42/0.08),0_4px_10px_rgb(30_58_95/0.18)] hover:bg-brand-hover hover:text-on-brand dark:shadow-none",
        secondary:
          "border border-line-strong bg-surface text-ink shadow-[0_1px_2px_rgb(15_23_42/0.05)] hover:bg-surface-2 hover:text-ink",
        quiet: "bg-transparent text-brand hover:bg-tint hover:text-brand",
        danger: "bg-danger text-white hover:opacity-90 hover:text-white dark:text-[#2a0a0a]",
      },
      size: {
        sm: "h-8 px-2.5 text-[13px]",
        md: "h-10 px-4 text-[14px]",
        lg: "h-12 px-5 text-[15px]",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

type ButtonVariants = VariantProps<typeof buttonVariants>;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonVariants & {
    // Shown busy and not clickable while its action runs.
    busy?: boolean;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, busy = false, className, type = "button", disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {children}
    </button>
  );
});

// A square button holding only an icon: the label is required, it is what
// screen readers and the tooltip say.
export const IconButton = forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, "size" | "aria-label"> & { label: string; size?: "sm" | "md" | "lg" }
>(function IconButton({ label, size = "md", variant = "secondary", className, ...props }, ref) {
  return (
    <Button
      ref={ref}
      aria-label={label}
      title={label}
      variant={variant}
      className={cn(
        "px-0",
        size === "sm" && "size-8",
        size === "md" && "size-10",
        size === "lg" && "size-12",
        className,
      )}
      {...props}
    />
  );
});

// A link that looks like a button (navigation, not an action): typed by the
// router like any <Link>, preloaded on hover.
const ButtonAnchor = forwardRef<
  HTMLAnchorElement,
  AnchorHTMLAttributes<HTMLAnchorElement> & ButtonVariants
>(function ButtonAnchor({ variant, size, className, ...props }, ref) {
  return <a ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});

export const ButtonLink = createLink(ButtonAnchor);
