// Le format d'un appel de server action entre le navigateur et le serveur
// (src/compat/server-action-reference.ts ↔ src/server/server-actions.ts).
//
// Sans FormData, les arguments voyagent tels quels (sérialisés par TanStack
// Start : dates, Map… compris). Avec un FormData (envoi d'images, formulaires
// à useActionState), tout l'appel devient un FormData, seul format qui
// transporte des fichiers : les autres arguments y sont en JSON.

export type ServerActionCall = { file: string; name: string; args: unknown[] };

// Ce que renvoie une server action : des données sérialisables, comme
// l'exigeait déjà Next.js.
type ActionResult = object | string | number | boolean | null | undefined;

export type ServerActionResponse = { result: ActionResult; revalidated: boolean };

const ACTION_FIELD = "$action";
const ARGS_FIELD = "$args";
const FORM_DATA_MARKER = "$formData";

export function encodeServerActionCall(call: ServerActionCall): ServerActionCall | FormData {
  if (!call.args.some((arg) => arg instanceof FormData)) return call;

  const body = new FormData();
  body.set(ACTION_FIELD, JSON.stringify({ file: call.file, name: call.name }));
  const args = call.args.map((arg, index) => {
    if (!(arg instanceof FormData)) return arg;
    for (const [key, value] of arg) body.append(`${index}:${key}`, value);
    return { [FORM_DATA_MARKER]: index };
  });
  body.set(ARGS_FIELD, JSON.stringify(args));
  return body;
}

export function decodeServerActionCall(input: unknown): ServerActionCall {
  if (!(input instanceof FormData)) {
    const call = input as Partial<ServerActionCall> | null;
    if (
      typeof call?.file !== "string" ||
      typeof call.name !== "string" ||
      !Array.isArray(call.args)
    ) {
      throw new Error("Invalid server action call");
    }
    return { file: call.file, name: call.name, args: call.args };
  }

  const { file, name } = JSON.parse(String(input.get(ACTION_FIELD)));
  const encodedArgs: unknown[] = JSON.parse(String(input.get(ARGS_FIELD)));
  const args = encodedArgs.map((arg) => {
    const index = (arg as Record<string, unknown> | null)?.[FORM_DATA_MARKER];
    if (typeof index !== "number") return arg;
    const formData = new FormData();
    const prefix = `${index}:`;
    for (const [key, value] of input) {
      if (key.startsWith(prefix)) formData.append(key.slice(prefix.length), value);
    }
    return formData;
  });
  if (typeof file !== "string" || typeof name !== "string") {
    throw new Error("Invalid server action call");
  }
  return { file, name, args };
}
