"use client";

import { useInView } from "@/hooks/use-in-view";
import { cn } from "@/lib/utils";

// Fade + rise on first scroll into view. `delay` (ms) is meant for staggering
// siblings in a grid — capped by callers, not here, since what's "too many"
// depends on the layout.
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <div
      ref={ref}
      style={{ transitionDelay: inView ? `${delay}ms` : "0ms" }}
      className={cn(
        "transition-all duration-700 ease-out",
        inView ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
