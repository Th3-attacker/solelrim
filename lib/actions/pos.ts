"use server";

import { tryCheckoutScope } from "@/lib/auth/scope";
import { revalidateSite } from "@/lib/revalidate";
import { commandContext } from "@/lib/auth/next-command-context";
import { createPosSaleCommand } from "@/lib/services/pos-commands";
import type { PosSaleResult } from "@/lib/services/pos-commands";

// An in-store sale at the checkout. The work itself is
// lib/services/pos-commands.ts, shared with the TanStack Start build.
export type { PosSaleResult } from "@/lib/services/pos-commands";

export async function createPosSale(input: unknown): Promise<PosSaleResult> {
  const scope = await tryCheckoutScope();
  if (scope.error) return { error: scope.error };
  const result = await createPosSaleCommand(await commandContext(scope), input);
  if (!result.error) revalidateSite();
  return result;
}
