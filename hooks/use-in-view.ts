import { useEffect, useRef, useState } from "react";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// Reveals once and stops observing — scrolling back up shouldn't re-hide
// content the visitor already saw. Starts already "in view" for anyone who
// prefers reduced motion, so the reveal never gates content on a transition
// that isn't going to play.
export function useInView<T extends HTMLElement>(
  options?: IntersectionObserverInit,
) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(prefersReducedMotion);

  useEffect(() => {
    if (inView) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px", ...options },
    );
    observer.observe(node);
    return () => observer.disconnect();
    // Intentionally runs once on mount — observer setup, not something that
    // should re-run if a caller passes a fresh options object each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ref, inView };
}
