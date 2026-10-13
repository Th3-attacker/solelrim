"use client";

import { useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "@/i18n/navigation";

// Same name as lib/realtime.ts's adminOrdersTopic (server-only there).
const topicOf = (productType: string) => `admin-orders:${productType}`;

// Never more than one refresh per this, whatever arrives.
const MIN_REFRESH_GAP_MS = 5_000;
// When the live channel is down: how often an open, visible tab catches up.
const FALLBACK_REFRESH_MS = 60_000;

// Keeps the open dashboard's orders (list, badge, details) current: Supabase
// Realtime pings it when a boutique's orders change (lib/realtime.ts), and it
// re-renders the page through its normal server path, so the ping itself
// carries no data. If the channel can't connect, a visible tab refreshes
// every minute instead, and always when it comes back to the foreground.
export function LiveOrders({ productType }: { productType: string }) {
  const router = useRouter();

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    let lastRefresh = 0;
    let live = false;

    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefresh < MIN_REFRESH_GAP_MS) return;
      lastRefresh = now;
      router.refresh();
    };

    const supabase =
      url && anonKey
        ? createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
        : null;
    const channel = supabase
      ?.channel(topicOf(productType))
      .on("broadcast", { event: "orders.changed" }, refresh)
      .subscribe((status) => {
        live = status === "SUBSCRIBED";
      });

    const fallback = setInterval(() => {
      if (!live) refresh();
    }, FALLBACK_REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      clearInterval(fallback);
      document.removeEventListener("visibilitychange", refresh);
      if (supabase && channel) void supabase.removeChannel(channel);
    };
  }, [productType, router]);

  return null;
}
