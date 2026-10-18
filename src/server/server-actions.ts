import "server-only";
import { isNotFound, isRedirect } from "@tanstack/react-router";
import { expectedErrorCode } from "@/lib/errors";
import { reportError } from "@/lib/report-error";
import type { ServerActionCall, ServerActionResponse } from "@/src/compat/server-action-protocol";
import { getAppRequestContext } from "@/src/server/request-context";

// Seuls les modules "use server" de lib/actions sont appelables : la même
// surface que les server actions de Next.js, ni plus ni moins.
const actionModules = import.meta.glob<Record<string, unknown>>([
  "/lib/actions/*.ts",
  "!/lib/actions/*.test.ts",
]);

export async function runServerAction({
  file,
  name,
  args,
}: ServerActionCall): Promise<ServerActionResponse> {
  const load = actionModules[file];
  const action = load
    ? ((await load())[name] as
        ((...args: unknown[]) => Promise<ServerActionResponse["result"]>) | undefined)
    : undefined;
  if (typeof action !== "function") {
    throw new Error("Unknown server action");
  }

  try {
    const result = await action(...args);
    const revalidated = getAppRequestContext()?.actionEffects.revalidated ?? false;
    return { result, revalidated };
  } catch (error) {
    // Redirections, 404 et refus volontaires (lib/errors.ts) remontent tels
    // quels jusqu'au navigateur.
    if (isRedirect(error) || isNotFound(error) || expectedErrorCode(error)) throw error;
    // Le reste est une erreur inattendue : consignée ici, et masquée en
    // production comme le faisait Next.js (le message peut contenir des
    // détails internes : requête SQL, chemin de fichier…).
    reportError("server-action", error, { action: `${file}#${name}` });
    if (process.env.NODE_ENV === "development") throw error;
    throw new Error("Internal server error");
  }
}
