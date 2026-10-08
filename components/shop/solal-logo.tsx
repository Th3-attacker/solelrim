import { useId } from "react";
import { DUNE_CUT, DUNE_PATH, DUNE_VIEWBOX, WORDMARK_PATH, WORDMARK_VIEWBOX } from "@/lib/brand/solal";

// The SOLAL boutique's header logo, drawn in currentColor so it follows the
// theme (marine, light blue in dark mode): the dune S alone on phones, the
// SOLΛL wordmark alone from md up. Decorative — the caller labels the link.
export function SolalHeaderLogo() {
  const maskId = useId();
  return (
    <>
      <svg viewBox={DUNE_VIEWBOX} className="h-8 w-auto shrink-0 md:hidden" aria-hidden="true">
        <defs>
          <mask id={maskId}>
            <rect width="100" height="100" fill="#fff" />
            <path d={DUNE_CUT} stroke="#000" strokeWidth="6.5" />
          </mask>
        </defs>
        <path
          d={DUNE_PATH}
          fill="none"
          stroke="currentColor"
          strokeWidth="13"
          strokeLinecap="round"
          mask={`url(#${maskId})`}
        />
      </svg>
      <svg viewBox={WORDMARK_VIEWBOX} className="hidden h-5 w-auto shrink-0 md:block" aria-hidden="true">
        <path d={WORDMARK_PATH} fill="currentColor" />
      </svg>
    </>
  );
}
