import { queryOptions } from "@tanstack/react-query";
import { getShell } from "./shell.functions";

// Refreshed by the live channel when orders change (live-orders.tsx), so
// the badges never wait for the next navigation.
export const shellQuery = queryOptions({
  queryKey: ["shell"],
  queryFn: () => getShell(),
});
