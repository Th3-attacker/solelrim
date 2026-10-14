import { createServerClient } from "@supabase/ssr";
import { getCookies, setCookie } from "@tanstack/react-start/server";
import { serverEnv } from "@/lib/env";

// Supabase Auth for the current request, its session in the request's
// cookies. Refreshed tokens are written back on the response, so any server
// function or page render keeps the session alive (what proxy.ts does for
// the Next.js build).
export function createSupabaseServerClient() {
  const env = serverEnv();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return Object.entries(getCookies()).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) setCookie(name, value, options);
      },
    },
  });
}
