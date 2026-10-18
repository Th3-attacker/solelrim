import { isRedirect } from "@tanstack/react-router";
import { encodeServerActionCall } from "@/src/compat/server-action-protocol";
import { invokeServerAction } from "@/src/server/server-actions.functions";

// Ce que devient une server action dans le navigateur
// (src/compat/server-actions-plugin.ts) : un appel distant, puis les deux
// comportements que Next.js assurait de lui-même —
// - une redirection lancée par l'action (redirect(), ex. après connexion)
//   est suivie par le routeur ;
// - si l'action a invalidé des données (revalidatePath/revalidateTag), la
//   page recharge ses loaders avant que l'appelant ne reçoive le résultat.
export function createServerActionReference(file: string, name: string) {
  return async (...args: unknown[]): Promise<unknown> => {
    // Le routeur du navigateur : ces références ne s'exécutent que là.
    const router = window.__TSR_ROUTER__!;
    try {
      const response = await invokeServerAction({
        data: encodeServerActionCall({ file, name, args }),
      });
      if (response.revalidated) await router.invalidate();
      return response.result;
    } catch (error) {
      if (isRedirect(error)) {
        await router.navigate(router.resolveRedirect(error).options);
        return undefined;
      }
      throw error;
    }
  };
}
