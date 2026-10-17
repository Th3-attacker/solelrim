import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie, getRequestHeader } from "@tanstack/react-start/server";
import { LOCALE_COOKIE, pickLocale } from "./config";

// The visitor's language when the address doesn't say: read from the request
// on the server, from the browser itself on a client-side navigation.
export const detectLocale = createIsomorphicFn()
  .server(() =>
    pickLocale({
      cookie: getCookie(LOCALE_COOKIE),
      acceptLanguage: getRequestHeader("accept-language"),
    }),
  )
  .client(() => {
    const cookie = document.cookie
      .split("; ")
      .find((entry) => entry.startsWith(`${LOCALE_COOKIE}=`))
      ?.slice(LOCALE_COOKIE.length + 1);
    return pickLocale({ cookie, acceptLanguage: navigator.languages.join(",") });
  });
