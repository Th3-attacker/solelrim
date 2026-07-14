"use client";

import { useEffect } from "react";

/**
 * A real label printer feeds a fixed 10x15cm sheet, so the print job for
 * this route must target that exact page size instead of the browser's
 * default A4/Letter. Injected directly into <head> at runtime because a
 * plain <style> rendered from a Server Component (or a route-scoped CSS
 * import) was not reliably reaching the print stylesheet in this Next.js
 * version — this client-side injection is what actually works.
 */
export function PrintPageSize() {
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = "@page { size: 10cm 15cm; margin: 5mm; }";
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return null;
}
