import type { AdminUser } from "@/lib/generated/prisma/client";
import type { AuditActor } from "@/lib/audit-log";

// Who runs a back-office command and on which boutique, already checked by
// the caller: lib/actions/* through the Next.js session, the TanStack Start
// build through its own middleware. The commands themselves
// (lib/services/*-commands.ts) don't know which.
export type CommandContext = {
  admin: Pick<AdminUser, "id" | "role">;
  productType: string;
  actor: AuditActor;
};
