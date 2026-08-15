import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

// Called from inside an already-authenticated Server Action, after the
// actual mutation succeeded — never lets a logging failure fail the action
// it's recording, just drops it (with a server-side console.error to
// surface if this starts happening a lot).
export async function logAdminAction(params: {
  adminUserId: string;
  productType: string;
  action: string;
  targetLabel: string;
}): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: params.adminUserId,
        adminEmail: user?.email ?? "?",
        productType: params.productType,
        action: params.action,
        targetLabel: params.targetLabel,
      },
    });
  } catch (err) {
    console.error("logAdminAction failed", err);
  }
}
