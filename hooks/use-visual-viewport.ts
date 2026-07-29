import * as React from "react"

type ViewportRect = { height: number; top: number } | null

// Measures the real visible area via the VisualViewport API instead of
// trusting CSS dvh, which on iOS Safari can lag by a frame on the very
// first on-screen-keyboard invocation after a page load (subsequent opens
// are fine) — leaving a sheet sized/positioned against a stale, larger
// viewport and overflowing behind the keyboard. Only measures while
// `active`, since visualViewport keeps firing on page scroll too.
export function useVisualViewport(active: boolean) {
  const cacheRef = React.useRef<ViewportRect>(null)

  const subscribe = React.useCallback(
    (onStoreChange: () => void) => {
      const vv = window.visualViewport
      if (!active || !vv) return () => {}
      vv.addEventListener("resize", onStoreChange)
      vv.addEventListener("scroll", onStoreChange)
      return () => {
        vv.removeEventListener("resize", onStoreChange)
        vv.removeEventListener("scroll", onStoreChange)
      }
    },
    [active]
  )

  const getSnapshot = React.useCallback((): ViewportRect => {
    const vv = window.visualViewport
    if (!active || !vv) {
      cacheRef.current = null
      return null
    }
    const next = { height: vv.height, top: vv.offsetTop }
    const cached = cacheRef.current
    if (cached && cached.height === next.height && cached.top === next.top) {
      return cached
    }
    cacheRef.current = next
    return next
  }, [active])

  const getServerSnapshot = React.useCallback((): ViewportRect => null, [])

  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

// Leaves a sliver of the (blurred) page visible above the sheet instead of
// going fully edge-to-edge, matching the reference bottom-sheet pattern.
export const SHEET_PEEK_INSET = 24

// Falls back to the dvh unit only until the first real measurement lands
// (or on browsers without VisualViewport support).
export function visualViewportStyle(
  rect: ViewportRect,
  topInset = 0,
): React.CSSProperties {
  return rect
    ? { height: `${rect.height - topInset}px`, top: `${rect.top + topInset}px` }
    : { height: `calc(100dvh - ${topInset}px)`, top: `${topInset}px` }
}
