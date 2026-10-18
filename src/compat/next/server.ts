import "server-only";
import { waitUntil } from "@vercel/functions";
import { reportError } from "@/lib/report-error";

// Remplace after() de next/server : la tâche part après la réponse, et la
// fonction Vercel reste en vie jusqu'à ce qu'elle se termine (waitUntil).
// Hors de Vercel (pnpm dev), elle s'exécute simplement en arrière-plan.
export function after(task: Promise<unknown> | (() => unknown)): void {
  const run = Promise.resolve()
    .then(() => (typeof task === "function" ? task() : task))
    .catch((error) => reportError("after", error));
  waitUntil(run);
}
