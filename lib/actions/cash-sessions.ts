"use server";

import { requireWritableAdminScope, tryCheckoutScope } from "@/lib/auth/scope";
import { revalidateAdmin } from "@/lib/revalidate";
import { commandContext } from "@/lib/auth/next-command-context";
import {
  openCashSessionCommand,
  addCashMovementCommand,
  closeCashSessionCommand,
  closeStoreDayCommand,
} from "@/lib/services/cash-sessions-commands";
import type { CashActionResult } from "@/lib/services/cash-sessions-commands";

// The till: opening, money in and out, closing, and the end-of-day closure.
// The work itself is lib/services/cash-sessions-commands.ts, shared with the
// TanStack Start build; these are the Next.js entry points.
export type { CashActionResult } from "@/lib/services/cash-sessions-commands";

export async function openCashSession(input: unknown): Promise<CashActionResult> {
  const scope = await tryCheckoutScope();
  if (scope.error) return { error: scope.error };
  const result = await openCashSessionCommand(await commandContext(scope), input);
  if (!result.error) revalidateAdmin();
  return result;
}

export async function addCashMovement(input: unknown): Promise<CashActionResult> {
  const scope = await tryCheckoutScope();
  if (scope.error) return { error: scope.error };
  const result = await addCashMovementCommand(await commandContext(scope), input);
  if (!result.error) revalidateAdmin();
  return result;
}

export async function closeCashSession(input: unknown): Promise<CashActionResult> {
  const scope = await tryCheckoutScope();
  if (scope.error) return { error: scope.error };
  const result = await closeCashSessionCommand(await commandContext(scope), input);
  if (!result.error) revalidateAdmin();
  return result;
}

export async function closeStoreDay(input: unknown): Promise<{ error?: string }> {
  const scope = await requireWritableAdminScope();
  const result = await closeStoreDayCommand(await commandContext(scope), input);
  if (!result.error) revalidateAdmin();
  return result;
}
