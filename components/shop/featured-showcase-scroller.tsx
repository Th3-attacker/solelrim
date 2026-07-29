"use client";

import { useEffect, useRef } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

// Light idle auto-scroll — advances by roughly one card every few seconds
// so the row feels alive without being pushy, loops back to the start at
// the end, and pauses the moment the user touches it (pointer over, drag,
// or tap) rather than fighting their scroll.
const AUTO_SCROLL_INTERVAL_MS = 3500;
const AUTO_SCROLL_STEP_PX = 280;

export function FeaturedShowcaseScroller({
  children,
}: {
  children: React.ReactNode[];
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const rtl = getComputedStyle(viewport).direction === "rtl";

    const tick = () => {
      if (pausedRef.current) return;
      const maxScroll = viewport.scrollWidth - viewport.clientWidth;
      const current = Math.abs(viewport.scrollLeft);
      const atEnd = current >= maxScroll - 4;
      const nextMagnitude = atEnd ? 0 : current + AUTO_SCROLL_STEP_PX;
      viewport.scrollTo({
        left: rtl ? -nextMagnitude : nextMagnitude,
        behavior: "smooth",
      });
    };

    const id = window.setInterval(tick, AUTO_SCROLL_INTERVAL_MS);
    const pause = () => {
      pausedRef.current = true;
    };
    const resume = () => {
      pausedRef.current = false;
    };

    viewport.addEventListener("pointerenter", pause);
    viewport.addEventListener("pointerdown", pause);
    viewport.addEventListener("pointerleave", resume);

    return () => {
      window.clearInterval(id);
      viewport.removeEventListener("pointerenter", pause);
      viewport.removeEventListener("pointerdown", pause);
      viewport.removeEventListener("pointerleave", resume);
    };
  }, []);

  return (
    <ScrollArea
      className="w-full"
      viewportRef={viewportRef}
      viewportClassName="snap-x snap-mandatory scroll-smooth"
    >
      <div className="flex gap-4 px-1 pe-4 pb-4">{children}</div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
