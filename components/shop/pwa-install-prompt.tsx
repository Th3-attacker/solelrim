"use client";

import { useEffect, useState } from "react";
import { Share } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

const DISMISS_STORAGE_KEY = "pwa-install-dismissed-at";
const REPROMPT_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
const SHOW_DELAY_MS = 3000;

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

function recentlyDismissed(): boolean {
  const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
  if (!raw) return false;
  const dismissedAt = Number(raw);
  return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < REPROMPT_AFTER_MS;
}

// Suggests installing the PWA on a visitor's first eligible visit — a real
// bottom sheet / dialog using the same primitives as every other drawer in
// the app, not a toast-style corner banner. Android/Chrome/desktop capture
// the native beforeinstallprompt event; iOS Safari never fires it at all
// (no programmatic install API there), so it gets instructions instead.
export function PwaInstallPrompt({ siteName }: { siteName: string }) {
  const t = useTranslations("shop");
  const isMobile = useIsMobile();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

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
    localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
    setOpen(false);
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    dismiss();
  }

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

  const body = showIosHint ? (
    <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2.5 text-sm text-foreground">
      <Share className="size-4 shrink-0 text-primary" />
      <span>{t("installIosBody")}</span>
    </div>
  ) : null;

  const action = !showIosHint && (
    <Button size="lg" className="w-full" onClick={handleInstall}>
      {t("installButton")}
    </Button>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(next) => (next ? setOpen(true) : dismiss())}>
        <SheetContent side="bottom" showHandle className="rounded-t-2xl">
          <SheetHeader className="items-center gap-3 text-center sm:items-start sm:text-start">
            {icon}
            <div className="flex flex-col gap-1">
              <SheetTitle>{t("installTitle", { siteName })}</SheetTitle>
              {!showIosHint && (
                <SheetDescription>{t("installBody")}</SheetDescription>
              )}
            </div>
          </SheetHeader>
          {body && <div className="px-4">{body}</div>}
          <SheetFooter>{action}</SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : dismiss())}>
      <DialogContent>
        <DialogHeader className="items-start gap-3">
          {icon}
          <DialogTitle>{t("installTitle", { siteName })}</DialogTitle>
          {!showIosHint && <DialogDescription>{t("installBody")}</DialogDescription>}
        </DialogHeader>
        {body}
        <DialogFooter>{action}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
