import "server-only";
import { serverEnv } from "@/lib/env";
import { reportError } from "@/lib/report-error";

// Tells the open admin dashboards of a boutique that its orders changed, so
// they refresh now instead of on the next navigation (components/dashboard/
// live-orders.tsx). Supabase Realtime carries it: a WebSocket Supabase hosts,
// which Vercel functions can't. The message holds nothing but the boutique's
// topic; the dashboard then re-reads the orders through its usual, checked
// server path.
export function adminOrdersTopic(productType: string): string {
  return `admin-orders:${productType}`;
}

export async function notifyOrdersChanged(productType: string): Promise<void> {
  try {
    const env = serverEnv();
    const response = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        messages: [{ topic: adminOrdersTopic(productType), event: "orders.changed", payload: {} }],
      }),
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) {
      reportError("notifyOrdersChanged", new Error(`Realtime answered ${response.status}`), { productType });
    }
  } catch (error) {
    // The dashboards still catch up through their fallback refresh.
    reportError("notifyOrdersChanged", error, { productType });
  }
}
