import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

// Cross-references AdminUser (Prisma) with Supabase Auth (email) rather
// than duplicating the email into AdminUser, so it can never drift if the
// email is ever changed in Supabase.
export async function listBoutiqueAdmins() {
  const [admins, { data, error }] = await Promise.all([
    prisma.adminUser.findMany({
      where: { role: "BOUTIQUE_ADMIN" },
      include: { storeType: true },
      orderBy: { createdAt: "desc" },
    }),
    createAdminClient().auth.admin.listUsers(),
  ]);
  if (error) throw error;

  const userById = new Map(data.users.map((u) => [u.id, u]));
  return admins.map((admin) => {
    const user = userById.get(admin.supabaseUserId);
    return {
      id: admin.id,
      email: user?.email ?? null,
      boutiqueLabel: admin.storeType?.label ?? admin.productType,
      canManageAppearance: admin.canManageAppearance,
      // Superadmin-assigned "must set up 2FA" flag — stored in Supabase
      // Auth's app_metadata (see setAdminMfaRequired) rather than Postgres,
      // since only a service-role client can write it, which already keeps
      // it tamper-proof from the admin it targets.
      mfaRequired: user?.app_metadata?.mfa_required === true,
      createdAt: admin.createdAt,
    };
  });
}
