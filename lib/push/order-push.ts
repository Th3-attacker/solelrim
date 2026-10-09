import { prisma } from "@/lib/prisma";
import { buildOrderPushMessage, type OrderPushEvent } from "@/lib/shop/client-messages";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const SEND_TIMEOUT_MS = 4000;

type ExpoTicket = { status: "ok" | "error"; details?: { error?: string } };

// Tells the customer's phone(s) that their order moved on. Housekeeping next
// to the status change that triggered it: it never throws and never makes the
// admin's action fail, a notification that can't go out is only logged.
export async function sendOrderPush(orderId: string, event: OrderPushEvent): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        reference: true,
        locale: true,
        productType: true,
        status: true,
        pushTokens: { select: { id: true, token: true } },
      },
    });
    if (!order || order.pushTokens.length === 0) return;

    const { title, body } = buildOrderPushMessage({
      event,
      locale: order.locale,
      reference: order.reference,
    });
    const messages = order.pushTokens.map(({ token }) => ({
      to: token,
      title,
      body,
      sound: "default",
      // What the app needs to open the right tracking screen when tapped.
      data: { reference: order.reference, status: order.status, boutique: order.productType },
    }));

    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(process.env.EXPO_ACCESS_TOKEN
          ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error("sendOrderPush: Expo answered", response.status);
      return;
    }

    // Tickets come back in the order of the messages. A phone that
    // uninstalled the app is reported as DeviceNotRegistered: forget its
    // token instead of pushing to it forever.
    const { data } = (await response.json()) as { data?: ExpoTicket[] };
    const gone = order.pushTokens
      .filter((_, index) => data?.[index]?.details?.error === "DeviceNotRegistered")
      .map((token) => token.id);
    if (gone.length > 0) {
      await prisma.pushToken.deleteMany({ where: { id: { in: gone } } });
    }
  } catch (error) {
    console.error("sendOrderPush failed", error);
  }
}
