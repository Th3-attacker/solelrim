import "server-only";
import type { AdminUser } from "@/lib/generated/prisma/client";
import { getAuditActor } from "@/lib/audit";
import type { CommandContext } from "@/lib/services/command-context";

// The Next.js build's way into a command: the scope its gate resolved, and
// the actor read from the session.
export async function commandContext(scope: {
  admin: AdminUser;
  productType: string;
}): Promise<CommandContext> {
  return {
    admin: scope.admin,
    productType: scope.productType,
    actor: await getAuditActor(scope.admin),
  };
}
