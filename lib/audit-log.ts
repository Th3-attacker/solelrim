import { prisma } from "@/lib/prisma";
import type { AdminRole } from "@/lib/generated/prisma/enums";
import type {
  InputJsonObject,
  TransactionClient,
} from "@/lib/generated/prisma/internal/prismaNamespace";
import type { AuditAction } from "@/lib/audit-actions";
import { reportError } from "@/lib/report-error";

// The audit trail itself, free of any framework: who acted is passed in.
// lib/audit.ts finds them from the Next.js session; the TanStack Start build
// from its own (src/server/admin-middleware.ts).

export type AuditActor = { id: string; role: AdminRole; email: string };

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
// operation — unlike recordAdminAction below.
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
// action it's recording, just drops it (reported, to surface if this starts
// happening a lot).
export async function recordAdminAction(
  actor: AuditActor,
  entry: Omit<AuditEntry, "oldValue" | "newValue">,
): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: actor.id,
        adminEmail: actor.email,
        adminRole: actor.role,
        productType: entry.productType,
        action: entry.action,
        targetLabel: entry.targetLabel,
        targetId: entry.targetId,
        reason: entry.reason,
      },
    });
  } catch (err) {
    reportError("logAdminAction", err, { action: entry.action });
  }
}
