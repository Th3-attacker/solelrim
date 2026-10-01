"use client";

import { useEffect } from "react";

/**
 * Applies an @page rule (paper size/margins) only while this route is
 * mounted. Injected into <head> at runtime because a plain <style> rendered
 * from a Server Component (or a route-scoped CSS import) was not reliably
 * reaching the print stylesheet in this Next.js version — this client-side
 * injection is what actually works.
 */
export function PrintPageStyle({ rule }: { rule: string }) {
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = rule;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, [rule]);

  return null;
}
