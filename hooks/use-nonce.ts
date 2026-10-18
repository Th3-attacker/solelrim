import { useRouter } from "@tanstack/react-router";

// Le nonce CSP de la page (src/start.ts) pour un <script> en ligne. Il n'existe
// que dans le HTML rendu par le serveur : le navigateur masque l'attribut une
// fois la page chargée, d'où suppressHydrationWarning sur ces balises.
export function useNonce(): string | undefined {
  return useRouter().options.ssr?.nonce;
}
