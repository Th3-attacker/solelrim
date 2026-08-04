"use client";

import { useEffect } from "react";

// SOLAL has no service worker of its own. A stray one left behind by a
// different project that once ran on the same origin (service worker scope
// is per protocol+host+port, so it outlives that other project entirely)
// will intercept every request here too and break the app in ways that look
// nothing like a SOLAL bug (e.g. "Failed to convert value to 'Response'").
// Unregistering anything found is always safe and a no-op in the normal case.
export function ServiceWorkerCleanup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });
  }, []);

  return null;
}
