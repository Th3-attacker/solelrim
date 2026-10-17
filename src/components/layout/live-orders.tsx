import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

// Same topic as lib/realtime.ts (server side), which pings it whenever a
// boutique's orders change.
const topicOf = (productType: string) => `admin-orders:${productType}`;

// Never more than one refresh per this, whatever arrives.
const MIN_REFRESH_GAP_MS = 5_000;
// When the live channel is down: how often an open, visible tab catches up.
const FALLBACK_REFRESH_MS = 60_000;

// Keeps an open admin current without reloading: Supabase Realtime (a
// WebSocket Supabase hosts, nothing to run on our side) says "orders
// changed", and the queries showing orders are marked stale and read again
// through their usual, checked server function. The ping carries no data.
// The Realtime client loads after the page, never delaying it.
export function LiveOrders({ productType }: { productType: string }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const url = import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    let lastRefresh = 0;
    let live = false;
    let stop = () => {};
    let cancelled = false;

    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefresh < MIN_REFRESH_GAP_MS) return;
      lastRefresh = now;
      // The menu's badges, and every list or detail of orders.
      void queryClient.invalidateQueries({ queryKey: ["shell"] });
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    };

    if (url && anonKey) {
      // Only the Realtime part of Supabase: a fraction of the full client.
      void import("@supabase/realtime-js").then(({ RealtimeClient }) => {
        if (cancelled) return;
        const endpoint = new URL("realtime/v1", url.endsWith("/") ? url : `${url}/`);
        endpoint.protocol = endpoint.protocol.replace("http", "ws");
        const realtime = new RealtimeClient(endpoint.href, { params: { apikey: anonKey } });
        const channel = realtime
          .channel(topicOf(productType))
          .on("broadcast", { event: "orders.changed" }, refresh)
          .subscribe((status) => {
            live = status === "SUBSCRIBED";
          });
        stop = () => {
          void realtime.removeChannel(channel);
          realtime.disconnect();
        };
      });
    }

    const fallback = setInterval(() => {
      if (!live) refresh();
    }, FALLBACK_REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      cancelled = true;
      clearInterval(fallback);
      document.removeEventListener("visibilitychange", refresh);
      stop();
    };
  }, [productType, queryClient]);

  return null;
}
