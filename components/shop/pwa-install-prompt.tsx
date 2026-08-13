"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Share } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const DISMISS_STORAGE_KEY = "pwa-install-dismissed";
const SHOW_DELAY_MS = 3000;
// Phones and tablets (iPad included, portrait or landscape) — not desktop.
// Deliberately wider than the app's usual 768px mobile breakpoint, which
// would misclassify an iPad as "desktop".
const ELIGIBLE_MAX_WIDTH = 1024;

// Chrome/Edge/Android fire this instead of installing immediately, so the
// browser's own mini-infobar can be swapped for this drawer — the payload
// isn't in lib.dom.d.ts, so it's typed by hand here.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari's own (non-standard) flag — not covered by display-mode.
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function hasBeenDismissed(): boolean {
  return localStorage.getItem(DISMISS_STORAGE_KEY) !== null;
}

// Same useSyncExternalStore shape as hooks/use-mobile.ts, just with a
// wider breakpoint local to this component — reusing that hook's 768px
// cutoff here would misclassify an iPad as desktop.
function subscribeToViewport(onStoreChange: () => void) {
  const mql = window.matchMedia(`(max-width: ${ELIGIBLE_MAX_WIDTH}px)`);
  mql.addEventListener("change", onStoreChange);
  return () => mql.removeEventListener("change", onStoreChange);
}
function getViewportSnapshot() {
  return window.matchMedia(`(max-width: ${ELIGIBLE_MAX_WIDTH}px)`).matches;
}
function getViewportServerSnapshot() {
  return false;
}

// Suggests installing the PWA on a visitor's first eligible visit, as a
// single bottom sheet (same shape as Cart/Favorites/Search — no separate
// desktop dialog to keep in sync). Phones and tablets only; skipped on
// desktop entirely. Android/Chrome capture the native beforeinstallprompt
// event; iOS Safari never fires it at all (no programmatic install API
// there), so it gets instructions instead. Either way — install, decline,
// or just close it — the choice is remembered permanently, one time only.
export function PwaInstallPrompt({ siteName }: { siteName: string }) {
  const t = useTranslations("shop");
  const isEligibleViewport = useSyncExternalStore(
    subscribeToViewport,
    getViewportSnapshot,
    getViewportServerSnapshot,
  );
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isStandalone() || hasBeenDismissed()) return;

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    const timer = setTimeout(() => {
      if (isIos()) {
        setShowIosHint(true);
        setOpen(true);
      }
    }, SHOW_DELAY_MS);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!deferredPrompt) return;
    const timer = setTimeout(() => setOpen(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [deferredPrompt]);

  function dismiss() {
    localStorage.setItem(DISMISS_STORAGE_KEY, "true");
    setOpen(false);
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    dismiss();
  }

  if (!isEligibleViewport) return null;

  // Plain <img>, not next/image: this is our own /icon-192 route (already
  // exactly the right size, generated on the fly via ImageResponse), and
  // piping it back through Next's sharp-based optimizer for a resize it
  // doesn't need crashes dev with "Input buffer contains unsupported image
  // format" — some incompatibility between ImageResponse's PNG encoding
  // and re-processing it a second time, not something to fight here.
  const icon = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/icon-192"
      alt=""
      width={64}
      height={64}
      className="mx-auto size-16 shrink-0 rounded-2xl object-cover shadow-md sm:mx-0"
    />
  );

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? setOpen(true) : dismiss())}>
      <SheetContent side="bottom" showHandle className="rounded-t-2xl">
        <SheetHeader className="items-center gap-3 text-center sm:items-start sm:text-start">
          {icon}
          <div className="flex flex-col gap-1">
            <SheetTitle>{t("installTitle", { siteName })}</SheetTitle>
            {!showIosHint && <SheetDescription>{t("installBody")}</SheetDescription>}
          </div>
        </SheetHeader>
        {showIosHint && (
          <div className="px-4">
            <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2.5 text-sm text-foreground">
              <Share className="size-4 shrink-0 text-primary" />
              <span>{t("installIosBody")}</span>
            </div>
          </div>
        )}
        {!showIosHint && (
          <SheetFooter>
            <Button size="lg" className="w-full" onClick={handleInstall}>
              {t("installButton")}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
