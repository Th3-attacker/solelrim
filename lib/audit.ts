import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/admin";
import type { AdminRole } from "@/lib/generated/prisma/enums";
import type { AdminUser } from "@/lib/generated/prisma/client";
import type {
  InputJsonObject,
  TransactionClient,
} from "@/lib/generated/prisma/internal/prismaNamespace";
import type { AuditAction } from "@/lib/audit-actions";

export type AuditActor = { id: string; role: AdminRole; email: string };

// Resolved before the transaction opens, so no network call ever runs while
// it holds row locks.
export async function getAuditActor(admin: AdminUser): Promise<AuditActor> {
  const user = await getSessionUser().catch(() => null);
  return { id: admin.id, role: admin.role, email: user?.email ?? "?" };
}

export type AuditEntry = {
  productType: string;
  action: AuditAction;
  targetLabel: string;
  targetId?: string;
  oldValue?: InputJsonObject;
  newValue?: InputJsonObject;
  reason?: string;
};

// For operations that must be traced (sales, cash register, refunds):
// written with the operation's own transaction client, so the entry exists
// if and only if the operation committed. A failure here fails the
// operation — unlike logAdminAction below.
export async function writeAuditLog(
  tx: TransactionClient,
  actor: AuditActor,
  entry: AuditEntry,
): Promise<void> {
  await tx.adminAuditLog.create({
    data: {
      adminUserId: actor.id,
      adminEmail: actor.email,
      adminRole: actor.role,
      productType: entry.productType,
      action: entry.action,
      targetLabel: entry.targetLabel,
      targetId: entry.targetId,
      oldValue: entry.oldValue,
      newValue: entry.newValue,
      reason: entry.reason,
    },
  });
}

// Best-effort trail for back-office actions (orders, products): called
// after the mutation succeeded and never lets a logging failure fail the
// action it's recording, just drops it (with a server-side console.error to
// surface if this starts happening a lot).
export async function logAdminAction(params: {
  admin: AdminUser;
  productType: string;
  action: AuditAction;
  targetLabel: string;
  targetId?: string;
  reason?: string;
}): Promise<void> {
  try {
    const actor = await getAuditActor(params.admin);
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: actor.id,
        adminEmail: actor.email,
        adminRole: actor.role,
        productType: params.productType,
        action: params.action,
        targetLabel: params.targetLabel,
        targetId: params.targetId,
        reason: params.reason,
      },
    });
  } catch (err) {
    console.error("logAdminAction failed", err);
  }
}
