import { withApi } from "@/lib/api/trace";
import { loadOpenBoutique } from "@/lib/api/boutique";
import { failFromCode, ok, readJson } from "@/lib/api/http";
import { registerPushToken, removePushToken } from "@/lib/push/register";

// POST   /api/v1/boutiques/{key}/orders/push
// DELETE /api/v1/boutiques/{key}/orders/push
//   { "phone": "37737353", "reference": "CMD-7KQ4M9XP",
//     "token": "ExponentPushToken[xxxxxxxx]" }
// POST asks to be notified when this order is confirmed, rejected, shipped,
// delivered or cancelled; DELETE stops it. The phone + reference are the
// proof the caller owns the order, like for tracking.
async function handle(
  request: Request,
  ctx: { params: Promise<{ key: string }> },
  action: typeof registerPushToken,
) {
  const { key } = await ctx.params;
  const { boutique, response } = await loadOpenBoutique(key);
  if (!boutique) return response;

  const result = await action(boutique.key, await readJson(request));
  if (result.error) return failFromCode(result.error, result.retryAfter);
  return ok({ ok: true });
}

function post(request: Request, ctx: { params: Promise<{ key: string }> }) {
  return handle(request, ctx, registerPushToken);
}

function remove(request: Request, ctx: { params: Promise<{ key: string }> }) {
  return handle(request, ctx, removePushToken);
}

export const POST = withApi(post);
export const DELETE = withApi(remove);
