// Les handlers HTTP de src/api (requête Web → réponse Web) gardent la
// signature des route handlers de Next.js : (request, { params }). Cette
// fonction les branche sur les server routes de TanStack Start
// (src/routes/api/**), sans les réécrire.

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type NextStyleHandler<P> = (
  request: Request,
  ctx: { params: Promise<P> },
) => Promise<Response> | Response;
type StartHandler = (ctx: {
  request: Request;
  params: Record<string, string>;
}) => Promise<Response> | Response;

export function apiHandlers<P>(
  handlers: Partial<Record<Method, NextStyleHandler<P>>>,
): Partial<Record<Method, StartHandler>> {
  return Object.fromEntries(
    Object.entries(handlers).map(([method, handler]) => [
      method,
      // Les paramètres de la route (ex. $key) sont ceux qu'attend le handler.
      ({ request, params }: Parameters<StartHandler>[0]) =>
        handler!(request, { params: Promise.resolve(params as P) }),
    ]),
  );
}
