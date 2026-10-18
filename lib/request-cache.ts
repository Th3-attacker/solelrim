import "server-only";
import { getRequest } from "@tanstack/react-start/server";

// Remplace cache() de React, qui ne mémorise qu'à l'intérieur des Server
// Components de Next.js (ailleurs, il ne fait rien) : un même appel, avec les
// mêmes arguments, n'est exécuté qu'une fois par requête — le layout, la page
// et les gardes d'accès redemandent souvent la même chose (l'admin connecté,
// la boutique…). Hors d'une requête (tests, scripts), aucun cache.
const perRequest = new WeakMap<Request, Map<unknown, Map<string, unknown>>>();

function currentRequest(): Request | null {
  try {
    return getRequest();
  } catch {
    return null;
  }
}

export function cache<Args extends unknown[], Result>(
  fn: (...args: Args) => Result,
): (...args: Args) => Result {
  return (...args: Args) => {
    const request = currentRequest();
    if (!request) return fn(...args);

    let byFunction = perRequest.get(request);
    if (!byFunction) perRequest.set(request, (byFunction = new Map()));
    let results = byFunction.get(fn);
    if (!results) byFunction.set(fn, (results = new Map()));

    const key = JSON.stringify(args);
    if (!results.has(key)) results.set(key, fn(...args));
    return results.get(key) as Result;
  };
}
