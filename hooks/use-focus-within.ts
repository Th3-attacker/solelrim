import * as React from "react"

const NON_TEXT_INPUT_TYPES = new Set([
  "file",
  "checkbox",
  "radio",
  "range",
  "color",
  "button",
  "submit",
  "reset",
  "image",
])

function isTextEntryElement(el: Element | null): boolean {
  if (el instanceof HTMLTextAreaElement) return true
  if (el instanceof HTMLInputElement) return !NON_TEXT_INPUT_TYPES.has(el.type)
  return false
}

// Tracks whether a genuine text-entry field (input/textarea, not a button,
// file picker, or the sheet's own programmatic focus-on-open) inside the
// returned ref currently has focus — i.e. whether the on-screen keyboard
// is open. Blur is deferred a frame so tabbing between sibling inputs
// doesn't flicker the state off and back on.
export function useFocusWithin<T extends HTMLElement>() {
  const ref = React.useRef<T>(null)
  const [focusWithin, setFocusWithin] = React.useState(false)

  const onFocus = React.useCallback((event: React.FocusEvent) => {
    if (isTextEntryElement(event.target)) setFocusWithin(true)
  }, [])

  const onBlur = React.useCallback(() => {
    requestAnimationFrame(() => {
      const active = document.activeElement
      if (!ref.current?.contains(active) || !isTextEntryElement(active)) {
        setFocusWithin(false)
      }
    })
  }, [])

  return { ref, focusWithin, onFocus, onBlur, reset: () => setFocusWithin(false) }
}
