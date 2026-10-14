"use server";

import { requireWritableAdminScope, tryCheckoutScope } from "@/lib/auth/scope";
import { revalidateAdmin } from "@/lib/revalidate";
import { commandContext } from "@/lib/auth/next-command-context";
import {
  lookupLoyaltyCardCommand,
  enrollLoyaltyCardCommand,
  updateLoyaltySettingsCommand,
} from "@/lib/services/loyalty-commands";
import type { LoyaltyCardResult } from "@/lib/services/loyalty-commands";

// The loyalty card at the checkout, and its settings. The work itself is
// lib/services/loyalty-commands.ts, shared with the TanStack Start build.
export type { LoyaltyCard, LoyaltyCardResult } from "@/lib/services/loyalty-commands";

export async function lookupLoyaltyCard(phone: string): Promise<LoyaltyCardResult> {
  const scope = await tryCheckoutScope();
  if (scope.error) return { error: scope.error };
  const result = await lookupLoyaltyCardCommand(await commandContext(scope), phone);
  return result;
}

export async function enrollLoyaltyCard(input: unknown): Promise<LoyaltyCardResult> {
  const scope = await tryCheckoutScope();
  if (scope.error) return { error: scope.error };
  const result = await enrollLoyaltyCardCommand(await commandContext(scope), input);
  return result;
}

export async function updateLoyaltySettings(input: unknown): Promise<{ error?: string }> {
  const scope = await requireWritableAdminScope();
  const result = await updateLoyaltySettingsCommand(await commandContext(scope), input);
  if (!result.error) revalidateAdmin();
  return result;
}
