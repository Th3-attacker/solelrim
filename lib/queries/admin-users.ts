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

  const emailById = new Map(data.users.map((u) => [u.id, u.email]));
  return admins.map((admin) => ({
    id: admin.id,
    email: emailById.get(admin.supabaseUserId) ?? null,
    boutiqueLabel: admin.storeType?.label ?? admin.productType,
    createdAt: admin.createdAt,
  }));
}
