import * as React from "react"

// Measures the real visible area via the VisualViewport API instead of
// trusting CSS dvh, which on iOS Safari can lag by a frame on the very
// first on-screen-keyboard invocation after a page load (subsequent opens
// are fine) — leaving a sheet sized/positioned against a stale, larger
// viewport and overflowing behind the keyboard. Only measures while
// `active`, since visualViewport keeps firing on page scroll too.
export function useVisualViewport(active: boolean) {
  const [rect, setRect] = React.useState<{ height: number; top: number } | null>(null)

  React.useEffect(() => {
    const vv = window.visualViewport
    if (!active || !vv) {
      setRect(null)
      return
    }

    function update() {
      setRect({ height: vv!.height, top: vv!.offsetTop })
    }
    update()
    vv.addEventListener("resize", update)
    vv.addEventListener("scroll", update)
    return () => {
      vv.removeEventListener("resize", update)
      vv.removeEventListener("scroll", update)
    }
  }, [active])

  return rect
}

// Leaves a sliver of the (blurred) page visible above the sheet instead of
// going fully edge-to-edge, matching the reference bottom-sheet pattern.
export const SHEET_PEEK_INSET = 24

// Falls back to the dvh unit only until the first real measurement lands
// (or on browsers without VisualViewport support).
export function visualViewportStyle(
  rect: { height: number; top: number } | null,
  topInset = 0,
): React.CSSProperties {
  return rect
    ? { height: `${rect.height - topInset}px`, top: `${rect.top + topInset}px` }
    : { height: `calc(100dvh - ${topInset}px)`, top: `${topInset}px` }
}
