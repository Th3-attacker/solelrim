import { createFileRoute, redirect } from "@tanstack/react-router";
import { detectLocale } from "~/i18n/detect";

// Every page lives under its language: "/" only says which one.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/$locale", params: { locale: detectLocale() } });
  },
});
