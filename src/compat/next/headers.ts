import "server-only";
import { getCookies, getRequestHeaders, setCookie } from "@tanstack/react-start/server";
import { getAppRequestContext } from "@/src/server/request-context";

// Remplace next/headers sur les API de requête de TanStack Start.

export async function headers(): Promise<Headers> {
  return getRequestHeaders();
}

type CookieOptions = Parameters<typeof setCookie>[2];
type Cookie = { name: string; value: string };

// Les cookies de la requête, vus à travers ceux déjà posés pendant cette même
// requête (cookieOverlay) : une session Supabase rafraîchie par le
// middleware est donc celle que lisent ensuite les loaders et les actions.
export async function cookies() {
  const overlay = getAppRequestContext()?.cookieOverlay;

  const current = (): Map<string, string> => {
    const merged = new Map(Object.entries(getCookies()));
    for (const [name, value] of overlay ?? []) {
      if (value === null) merged.delete(name);
      else merged.set(name, value);
    }
    return merged;
  };

  const set = (
    nameOrCookie: string | (Cookie & CookieOptions),
    value?: string,
    options?: CookieOptions,
  ) => {
    const {
      name,
      value: cookieValue,
      ...rest
    } = typeof nameOrCookie === "string"
      ? { name: nameOrCookie, value: value ?? "", ...options }
      : nameOrCookie;
    setCookie(name, cookieValue, rest);
    overlay?.set(name, cookieValue);
  };

  return {
    get(name: string): Cookie | undefined {
      const cookieValue = current().get(name);
      return cookieValue === undefined ? undefined : { name, value: cookieValue };
    },
    getAll(): Cookie[] {
      return [...current()].map(([name, cookieValue]) => ({ name, value: cookieValue }));
    },
    has(name: string): boolean {
      return current().has(name);
    },
    set,
    delete(name: string) {
      setCookie(name, "", { path: "/", maxAge: 0 });
      overlay?.set(name, null);
    },
  };
}
