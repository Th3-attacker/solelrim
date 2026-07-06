import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS. Server-only: never import this into
 * anything that ships to the browser. Used for admin bootstrap and storage
 * operations that need elevated privileges.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
