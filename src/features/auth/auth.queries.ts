import { queryOptions } from "@tanstack/react-query";
import { getAdminSession } from "./auth.functions";

// Asked by every admin page before it loads (routing only: each server
// function checks the caller again). Kept a minute, so moving between pages
// costs no round trip to Supabase Auth; signing in or out drops it.
export const adminSessionQuery = queryOptions({
  queryKey: ["admin-session"],
  queryFn: () => getAdminSession(),
  staleTime: 60_000,
});
