"use server";

import { requireWritableAdminScope, tryCheckoutScope } from "@/lib/auth/scope";
import { revalidateAdmin } from "@/lib/revalidate";
import { commandContext } from "@/lib/auth/next-command-context";
import {
  requestRefundCommand,
  approveRefundCommand,
  rejectRefundCommand,
} from "@/lib/services/refunds-commands";
import type { RefundActionResult } from "@/lib/services/refunds-commands";

// Refunds: asked at the checkout, decided by an admin. The work itself is
// lib/services/refunds-commands.ts, shared with the TanStack Start build.
export type { RefundActionResult } from "@/lib/services/refunds-commands";

export async function requestRefund(input: unknown): Promise<RefundActionResult> {
  const scope = await tryCheckoutScope();
  if (scope.error) return { error: scope.error };
  const result = await requestRefundCommand(await commandContext(scope), input);
  if (!result.error) revalidateAdmin();
  return result;
}

export async function approveRefund(input: unknown): Promise<RefundActionResult> {
  const scope = await requireWritableAdminScope();
  const result = await approveRefundCommand(await commandContext(scope), input);
  if (!result.error) revalidateAdmin();
  return result;
}

export async function rejectRefund(input: unknown): Promise<RefundActionResult> {
  const scope = await requireWritableAdminScope();
  const result = await rejectRefundCommand(await commandContext(scope), input);
  if (!result.error) revalidateAdmin();
  return result;
}
