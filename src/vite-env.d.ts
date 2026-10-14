/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Public by design: the browser needs them for Supabase Realtime.
  readonly NEXT_PUBLIC_SUPABASE_URL?: string;
  readonly NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
}
