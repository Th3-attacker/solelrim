import { getSessionUser } from "@/lib/auth/admin";
import type { AdminUser } from "@/lib/generated/prisma/client";
import type { AuditAction } from "@/lib/audit-actions";
import { recordAdminAction, type AuditActor } from "@/lib/audit-log";

// The Next.js side of the audit trail (lib/audit-log.ts): the actor comes
// from the current session.
export { writeAuditLog, recordAdminAction } from "@/lib/audit-log";
export type { AuditActor, AuditEntry } from "@/lib/audit-log";

// Resolved before the transaction opens, so no network call ever runs while
// it holds row locks.
export async function getAuditActor(admin: AdminUser): Promise<AuditActor> {
  const user = await getSessionUser().catch(() => null);
  return { id: admin.id, role: admin.role, email: user?.email ?? "?" };
}

// Best-effort, see recordAdminAction: a failure to find the actor or to
// write the line never fails the action it records.
export async function logAdminAction(params: {
  admin: AdminUser;
  productType: string;
  action: AuditAction;
  targetLabel: string;
  targetId?: string;
  reason?: string;
}): Promise<void> {
  const { admin, ...entry } = params;
  await recordAdminAction(await getAuditActor(admin), entry);
}
