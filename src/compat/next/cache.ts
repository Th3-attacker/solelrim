import "server-only";
import { getAppRequestContext } from "@/src/server/request-context";

// Remplace le cache de données de next/cache par un cache en mémoire, propre
// à chaque instance du serveur.
//
// Différence avec Next.js : son cache était partagé par toutes les instances
// Vercel, celui-ci ne l'est pas. Une écriture expire le cache de l'instance
// qui l'a faite ; les autres gardent leur copie au plus `revalidate`
// secondes (lib/data-cache.ts garde ce délai court pour cette raison).

type Entry = { value: Promise<unknown>; expiresAt: number; tags: readonly string[] };

const entries = new Map<string, Entry>();

export function unstable_cache<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
  keyParts: readonly string[] = [],
  options: { tags?: readonly string[]; revalidate?: number | false } = {},
): (...args: Args) => Promise<Result> {
  const ttlMs = options.revalidate ? options.revalidate * 1000 : Infinity;
  return (...args: Args) => {
    const key = JSON.stringify([keyParts, args]);
    const hit = entries.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value as Promise<Result>;

    const value = fn(...args);
    entries.set(key, { value, expiresAt: Date.now() + ttlMs, tags: options.tags ?? [] });
    // Un échec n'est jamais mis en cache : l'appel suivant réessaie.
    value.catch(() => {
      if (entries.get(key)?.value === value) entries.delete(key);
    });
    return value;
  };
}

// Signale au navigateur, à la fin de la server action en cours, que les
// données affichées ont changé (src/server/server-actions.ts).
function markRevalidated(): void {
  const context = getAppRequestContext();
  if (context) context.actionEffects.revalidated = true;
}

// Next.js re-rendait les pages concernées ; ici, la page courante recharge
// ses loaders. Le chemin ne sert plus qu'à la lisibilité des appelants.
export function revalidatePath(_path?: string, _type?: "layout" | "page"): void {
  markRevalidated();
}

export function revalidateTag(tag: string, _profile?: unknown): void {
  for (const [key, entry] of entries) {
    if (entry.tags.includes(tag)) entries.delete(key);
  }
  markRevalidated();
}
