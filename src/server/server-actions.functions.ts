import { createServerFn } from "@tanstack/react-start";
import {
  decodeServerActionCall,
  type ServerActionResponse,
} from "@/src/compat/server-action-protocol";
import { runServerAction } from "@/src/server/server-actions";

// L'unique point d'entrée réseau des server actions (voir
// src/compat/server-actions-plugin.ts). POST + middleware CSRF de
// src/start.ts : seule une page de ce site peut l'appeler.
export const invokeServerAction = createServerFn({ method: "POST" })
  .validator((input: unknown) => decodeServerActionCall(input))
  .handler(({ data }): Promise<ServerActionResponse> => runServerAction(data));
