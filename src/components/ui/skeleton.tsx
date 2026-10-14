import { cn } from "~/lib/cn";

// Where content is about to appear, the same size, so nothing jumps.
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block animate-pulse rounded-control bg-tile motion-reduce:animate-none",
        className,
      )}
    />
  );
}
