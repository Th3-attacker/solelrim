import "server-only";
import { z } from "zod";

// The variables the server can't run without (see .env.local.example).
// Checked once at startup (instrumentation.ts), so a missing one is a clear
// line in the logs instead of a cryptic failure on the first request that
// needs it; read through serverEnv() instead of `process.env.X!`.
const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let checked: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (!checked) {
    const result = serverEnvSchema.safeParse(process.env);
    if (!result.success) {
      const names = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
      throw new Error(
        `Missing or invalid environment variables: ${names.join(", ")} (see .env.local.example)`,
      );
    }
    checked = result.data;
  }
  return checked;
}
