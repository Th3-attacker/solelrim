import { revalidatePath } from "next/cache";
import { cancelExpiredPendingOrders } from "@/lib/shop/pending-expiry";

// GET /api/cron/expire-pending-orders — called by Vercel Cron (vercel.json),
// which sends "Authorization: Bearer $CRON_SECRET". Without CRON_SECRET set,
// the route refuses everything rather than run unauthenticated.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const cancelled = await cancelExpiredPendingOrders();
  if (cancelled.length > 0) {
    console.info(JSON.stringify({ cron: "expire-pending-orders", cancelled }));
    revalidatePath("/admin/orders");
    revalidatePath("/", "layout");
  }
  return Response.json({ cancelled: cancelled.length });
}
