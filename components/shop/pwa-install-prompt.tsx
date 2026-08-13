"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

const DISMISS_STORAGE_KEY = "pwa-install-dismissed-at";
const REPROMPT_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
const SHOW_DELAY_MS = 3000;

// Chrome/Edge/Android fire this instead of installing immediately, so the
// browser's own mini-infobar can be swapped for this banner — the payload
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

// Suggests installing the PWA on a visitor's first visit (any visit, really
// — it only ever shows once until dismissed, then again after ~30 days).
// Android/Chrome/desktop get the real install prompt via beforeinstallprompt;
// iOS Safari never fires that event at all, so it gets instructions instead
// — there is no programmatic install API there.
export function PwaInstallPrompt({ siteName }: { siteName: string }) {
  const t = useTranslations("shop");
  const tCommon = useTranslations("common");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [visible, setVisible] = useState(false);

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
        setVisible(true);
      }
    }, SHOW_DELAY_MS);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!deferredPrompt) return;
    const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [deferredPrompt]);

  function dismiss() {
    localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
    setVisible(false);
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    dismiss();
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-40 mx-auto w-auto max-w-sm pb-[env(safe-area-inset-bottom)] sm:end-4 sm:start-auto sm:mx-0 sm:w-full">
      <div className="flex items-start gap-3 rounded-2xl border bg-popover p-4 text-popover-foreground shadow-lg">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Download className="size-4" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-sm font-semibold">{t("installTitle", { siteName })}</p>
          {showIosHint ? (
            <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              <span>{t("installIosBody")}</span>
              <Share className="inline size-3.5 shrink-0" />
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">{t("installBody")}</p>
          )}
          {!showIosHint && (
            <Button size="sm" className="mt-1.5 self-start" onClick={handleInstall}>
              {t("installButton")}
            </Button>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="-me-1 -mt-1 shrink-0"
          aria-label={tCommon("close")}
          onClick={dismiss}
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
