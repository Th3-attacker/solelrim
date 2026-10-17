"use server";

import { requireWritableAdminScope } from "@/lib/auth/scope";
import { revalidateAdmin, revalidateSite } from "@/lib/revalidate";
import { commandContext } from "@/lib/auth/next-command-context";
import {
  createSaleCommand,
  cancelSaleCommand,
  updateSaleCommand,
} from "@/lib/services/sales-commands";
import type { SaleActionResult } from "@/lib/services/sales-commands";
import type { SaleInput } from "@/lib/validation/sale";

// Back-office sales: recording, cancelling, correcting. The work itself is
// lib/services/sales-commands.ts, shared with the TanStack Start build.
export type { SaleActionResult } from "@/lib/services/sales-commands";

export async function createSale(input: SaleInput): Promise<SaleActionResult> {
  const scope = await requireWritableAdminScope();
  const result = await createSaleCommand(await commandContext(scope), input);
  if (!result.error) revalidateSite();
  return result;
}

export async function cancelSale(input: unknown): Promise<{ error?: string }> {
  const scope = await requireWritableAdminScope();
  const result = await cancelSaleCommand(await commandContext(scope), input);
  if (!result.error) revalidateSite();
  return result;
}

export async function updateSale(input: unknown): Promise<{ error?: string }> {
  const scope = await requireWritableAdminScope();
  const result = await updateSaleCommand(await commandContext(scope), input);
  if (!result.error) revalidateAdmin();
  return result;
}
