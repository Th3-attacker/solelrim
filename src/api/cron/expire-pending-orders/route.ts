import { createHash, timingSafeEqual } from "node:crypto";
import { cancelExpiredPendingOrders } from "@/lib/services/pending-expiry";
import { revalidateSite } from "@/lib/revalidate";

// Compare deux secrets en temps constant : on hache d'abord les deux valeurs
// (longueur fixe, que `timingSafeEqual` exige) pour ne rien révéler du secret
// par le temps de réponse, contrairement à une comparaison `!==`.
function secretsMatch(received: string | null, expected: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(received ?? ""), digest(expected));
}

// GET /api/cron/expire-pending-orders — called by Vercel Cron (vite.config.ts),
// which sends "Authorization: Bearer $CRON_SECRET". Without CRON_SECRET set,
// the route refuses everything rather than run unauthenticated.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !secretsMatch(request.headers.get("authorization"), `Bearer ${secret}`)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const cancelled = await cancelExpiredPendingOrders();
  if (cancelled.length > 0) {
    console.info(JSON.stringify({ cron: "expire-pending-orders", cancelled }));
    revalidateSite();
  }
  return Response.json({ cancelled: cancelled.length });
}
