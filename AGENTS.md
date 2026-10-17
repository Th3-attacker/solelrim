<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Règles de travail

Règles non négociables, applicables à toutes les sessions et à toutes les tâches.

## 1. Confirmation avant toute modification du code

- **Ne jamais modifier la base de code sans confirmation explicite** de l'utilisateur.
- Toute demande d'implémentation commence par un **plan d'implémentation détaillé** (fichiers concernés, approche, impacts), présenté avant d'écrire le moindre code.
- **Demander la confirmation, et continuer à la demander jusqu'à ce que l'utilisateur confirme clairement.** Un silence, une réponse floue ou une reformulation ne valent pas confirmation.
- **Tant que l'utilisateur n'a pas dit « Go » explicitement, ne toucher à aucun fichier.** L'analyse, la lecture et le plan sont autorisés ; l'écriture, l'édition et la suppression ne le sont pas.
- Seule exception : la création ou la mise à jour de ce fichier `AGENTS.md`, quand l'utilisateur le demande explicitement.

## 2. Plan d'implémentation

- Toujours produire un plan détaillé avant toute implémentation : objectif, étapes ordonnées, fichiers ajoutés/modifiés/supprimés, risques et alternatives.
- Attendre le « Go » de l'utilisateur avant d'exécuter le plan.

## 3. Langue

- **Toujours répondre en français** : analyses, plans, questions, résumés.
- Exception : le code, les identifiants techniques et les noms de fichiers restent en anglais ; les **commentaires du code ajouté ou modifié sont en français** (voir règle 8).

## 4. Résumé d'opération après génération de code

Après chaque implémentation, fournir systématiquement :

1. Un **résumé des opérations** réalisées.
2. Une **liste de tous les fichiers concernés**, classés par : **ajoutés**, **modifiés**, **supprimés**.
3. Pour **chaque fichier**, la **raison** du changement.

## 5. Relecture du fichier agent

- **Avant de commencer une nouvelle session, lire ce fichier `AGENTS.md`** (et s'y conformer) pour connaître l'ensemble des règles en vigueur.

## 6. Commits, issues et pull requests

- Quand l'utilisateur demande un commit, le **découper en plusieurs commits logiques** plutôt qu'un commit unique.
- Chaque commit suit la norme [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) :
  - Format : `<type>(<scope optionnel>): <description>` — présent, sans majuscule initiale ni point final, sans espace avant les deux-points.
  - Types autorisés dans ce dépôt : `feat`, `fix`, `refactor`, `perf`, `style`, `test`, `docs`, `build`, `ci`, `chore`, `revert`.
  - Exemples : `feat(products): ajouter le filtre par catégorie`, `fix(cart): corriger le calcul du total avec remise`.
- Suivre le workflow du dépôt (voir `README.md`) : **créer une issue** GitHub pour la tâche, **créer une branche** depuis `dev` (`<type>/<numero-issue>-<slug>`), committer, puis **ouvrir une PR vers `dev`** (jamais directement vers `staging` ni `master`).

## 7. Aucune attribution d'auteur

- **Ne jamais ajouter de nom d'auteur** dans le code : ni `Co-Authored-By`, ni « Generated with… », ni aucune mention d'outil ou d'IA — ni dans le code, ni dans les commentaires, ni dans les messages de commit, ni dans les descriptions de PR.

## 8. Qualité du code (DRY / SOLID)

- **DRY** : pas de duplication — extraire les logiques réutilisables dans des fonctions, hooks ou modules partagés.
- **SOLID** :
  - **S** — responsabilités uniques, classes/fonctions mono-objectif ;
  - **O** — ouvert/fermé : étendre par ajout, pas par modification ;
  - **L** — substituabilité des dérivés ;
  - **I** — interfaces minimales, dépendre d'abstractions ;
  - **D** — injecter les dépendances, éviter les dépendances concrètes directes.
- **Ajouter des commentaires explicatifs en français** pour tout code ajouté ou modifié, surtout là où le *pourquoi* n'est pas évident (conformité au style du dépôt, où les commentaires expliquent les intentions).

## 9. Synthèse des règles de sécurité sur le code

En résumé, dans l'ordre de priorité :

1. Ne jamais toucher au code sans confirmation.
2. Tant que « Go » n'a pas été prononcé, ne rien écrire.
3. Toujours un plan détaillé en premier.
4. Toujours en français.
5. Résumé d'opération + liste des fichiers (ajoutés / modifiés / supprimés) avec justification, après chaque implémentation.
6. Commits Conventional Commits découpés, avec issues et PRs.
7. Aucune attribution d'auteur dans le code ni les commits.
8. Code DRY et SOLID, commenté en français.
