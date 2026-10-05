import { prisma } from "@/lib/prisma";
import { pushRegistrationSchema } from "@/lib/validation/push";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const PUSH_RATE_LIMIT = { windowMs: 15 * 60 * 1000, max: 20 };
// A customer with a phone, a tablet and a reinstall: a handful at most. Past
// this the oldest token is dropped so the table can't be filled for one order.
const MAX_TOKENS_PER_ORDER = 5;

async function findOrder(productType: string, input: unknown) {
  const ip = await getClientIp();
  if (!(await checkRateLimit(`push:${ip}`, PUSH_RATE_LIMIT))) {
    return { error: "rateLimited" as const };
  }
  const parsed = pushRegistrationSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid" as const };

  const order = await prisma.order.findFirst({
    where: {
      productType,
      customerPhone: parsed.data.phone,
      reference: parsed.data.reference.toUpperCase(),
    },
    select: { id: true },
  });
  if (!order) return { error: "notFound" as const };
  return { orderId: order.id, token: parsed.data.token };
}

// The app asks to be told about this order's progress.
export async function registerPushToken(
  productType: string,
  input: unknown,
): Promise<{ error?: string }> {
  const found = await findOrder(productType, input);
  if ("error" in found) return { error: found.error };

  await prisma.pushToken.upsert({
    where: { orderId_token: { orderId: found.orderId, token: found.token } },
    update: {},
    create: { orderId: found.orderId, token: found.token },
  });

  const tokens = await prisma.pushToken.findMany({
    where: { orderId: found.orderId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (tokens.length > MAX_TOKENS_PER_ORDER) {
    await prisma.pushToken.deleteMany({
      where: { id: { in: tokens.slice(MAX_TOKENS_PER_ORDER).map((token) => token.id) } },
    });
  }
  return {};
}

// The customer turned notifications off for this order.
export async function removePushToken(
  productType: string,
  input: unknown,
): Promise<{ error?: string }> {
  const found = await findOrder(productType, input);
  if ("error" in found) return { error: found.error };

  await prisma.pushToken.deleteMany({ where: { orderId: found.orderId, token: found.token } });
  return {};
}
