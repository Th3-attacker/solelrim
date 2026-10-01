import { useCallback, useSyncExternalStore } from "react";

// `null` until the browser has answered — the server can't know the screen
// width, so a caller renders neither variant during SSR/hydration instead
// of guessing one and visibly swapping it out a moment later.
export function useMediaQuery(query: string): boolean | null {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => null,
  );
}
