import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "~/lib/cn";

// Thin border, no shadow at rest: shadows are for what floats.
export function Card({
  as: Tag = "div",
  className,
  ...props
}: HTMLAttributes<HTMLElement> & { as?: "div" | "section" | "article" | "aside" }) {
  return (
    <Tag
      className={cn("min-w-0 rounded-card border border-line bg-surface", className)}
      {...props}
    />
  );
}

// A card's title row: the heading, and its actions at the end.
export function CardHeader({
  title,
  titleId,
  actions,
  className,
}: {
  title: ReactNode;
  titleId?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-2", className)}
    >
      <h2 id={titleId} className="text-card-title">
        {title}
      </h2>
      {actions}
    </div>
  );
}
