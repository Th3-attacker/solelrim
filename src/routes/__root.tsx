import type { ReactNode } from "react";
import type { QueryClient } from "@tanstack/react-query";
import {
  HeadContent,
  Outlet,
  ScriptOnce,
  Scripts,
  createRootRouteWithContext,
  useParams,
} from "@tanstack/react-router";
import { DEFAULT_LOCALE, getDirection, isLocale } from "~/i18n/config";
import appCss from "~/styles/app.css?url";
import interLatin from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      // resizes-content: the on-screen keyboard shrinks the layout viewport,
      // so sheets fixed to the bottom stay above it.
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, interactive-widget=resizes-content",
      },
      { title: "SOLAL" },
    ],
    links: [
      // The Latin face of Inter, needed for the first paint of every page.
      {
        rel: "preload",
        href: interLatin,
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  component: RootComponent,
});

// Before the first paint: the theme the admin chose (same "theme" key as the
// Next.js build's next-themes), else the device's, so the page never flashes
// light before turning dark.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  const { locale: param } = useParams({ strict: false });
  const locale = isLocale(param) ? param : DEFAULT_LOCALE;

  return (
    // The theme script sets the class before React hydrates.
    <html lang={locale} dir={getDirection(locale)} suppressHydrationWarning>
      <head>
        <ScriptOnce>{THEME_SCRIPT}</ScriptOnce>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
