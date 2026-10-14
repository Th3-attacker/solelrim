import type { ReactNode } from "react";
import { cn } from "~/lib/cn";

// A status is a dot and a word, never the color alone.
export type StatusTone = "pend" | "conf" | "ship" | "ok" | "bad" | "warn" | "mute";

const TONES: Record<StatusTone, string> = {
  pend: "bg-pend-bg text-pend-ink",
  conf: "bg-tint text-brand",
  ship: "bg-ship-bg text-ship-ink",
  ok: "bg-ok-bg text-ok-ink",
  bad: "bg-bad-bg text-bad-ink",
  warn: "bg-warn-bg text-warn-ink",
  mute: "bg-tile text-ink-2",
};

export function Status({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full py-[3px] ps-2 pe-[9px] text-[12px] leading-4 font-semibold whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

// A count on a menu entry or a tab ("17 to check"). The label says what is
// counted; the number alone is shown.
export function CountBadge({
  count,
  label,
  tone = "pend",
}: {
  count: number;
  label: string;
  tone?: "pend" | "brand" | "mute";
}) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "rounded-full px-[7px] py-0.5 text-[11px] leading-4 font-bold tabular-nums",
        tone === "pend" && "bg-pend-bg text-pend-ink",
        tone === "brand" && "bg-tint text-brand",
        tone === "mute" && "bg-tile text-ink-2",
      )}
    >
      <span aria-hidden="true">{count}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
