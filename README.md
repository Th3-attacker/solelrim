# Solelrim

Plateforme e-commerce multi-boutique. Une seule codebase sert plusieurs
boutiques indépendantes (`StoreType` — ex. SOLAL pour le sport), chacune
avec sa propre marque, son thème, son catalogue et sa gestion, reprise soit
via `/{locale}/{storeType}`, soit sur son propre nom de domaine. Le paiement
est manuel : le client commande, paie sur un compte mobile money affiché,
envoie une capture WhatsApp, un admin confirme depuis le dashboard — pas de
passerelle de paiement.

**Stack** : Next.js 16 (App Router, Turbopack) · TypeScript · Prisma +
PostgreSQL (Supabase) · Supabase Auth (admin) & Storage (images) ·
next-intl (fr/en/ar, RTL pour l'arabe) · Tailwind v4 · Vitest · Sentry
(suivi d'erreurs, optionnel — voir `NEXT_PUBLIC_SENTRY_DSN`).

## Installation locale

Prérequis : Node 20+, [pnpm](https://pnpm.io) (voir `packageManager` dans
[`package.json`](./package.json) — `corepack enable` l'installe automatiquement
à la bonne version), un projet Supabase (base Postgres + Auth + Storage).

```bash
pnpm install
cp .env.local.example .env.local   # remplir avec les identifiants du projet Supabase
pnpm exec prisma generate
pnpm exec prisma migrate deploy    # applique les migrations existantes
pnpm run db:seed                   # optionnel — jeu de données de démo
pnpm dev
```

Ouvrir [http://localhost:3000](http://localhost:3000). Les variables
requises sont documentées dans [`.env.local.example`](./.env.local.example).

Pour créer les buckets Supabase Storage (`product-images`, `payment-proofs`)
et, optionnellement, un premier compte admin :

```bash
SETUP_ADMIN_EMAIL=admin@example.com SETUP_ADMIN_PASSWORD=... pnpm exec tsx scripts/setup-supabase.ts
```

## Déploiement

`master` est déployé automatiquement sur Vercel à chaque merge (voir le
workflow `dev` → `staging` → `master` ci-dessous). Vercel détecte pnpm via
`pnpm-lock.yaml`. `pnpm run build` applique les migrations Prisma en attente
(`prisma migrate deploy`) avant de builder — s'assurer que
`DATABASE_URL`/`DIRECT_URL` pointent vers la bonne base avant de déployer.

## Workflow de contribution

Le dépôt suit 3 branches permanentes : `dev` (développement) → `staging` (tests avant prod) → `master` (production, déployée automatiquement sur Vercel).

**Chaque nouvelle tâche suit ce cycle :**

```
1. Créer une issue
2. Créer une branche depuis dev pour cette issue
3. Committer (Conventional Commits)
4. Ouvrir une Pull Request vers dev
5. Merger la PR, supprimer la branche
```

`staging` et `master` ne reçoivent jamais de branche de tâche directement — elles sont mises à jour par merge depuis `dev`/`staging` une fois le lot de tâches validé.

### 1. Issues

Toute tâche (bug, fonctionnalité, tâche technique) commence par une issue GitHub, même pour du travail solo — ça garde un historique et un numéro à référencer dans la branche/PR/commits.

```bash
gh issue create \
  --title "Ajouter le filtre par catégorie sur /products" \
  --body "Description du besoin, contexte, critères d'acceptation." \
  --label "enhancement"
```

Labels disponibles : `bug`, `enhancement`, `documentation`, `question`, `good first issue`, `help wanted`, `duplicate`, `invalid`, `wontfix`.

### 2. Branches

Une branche par issue, créée depuis `dev` à jour :

```bash
git checkout dev
git pull origin dev
git checkout -b <type>/<numero-issue>-<slug-court>
```

Exemples : `feat/42-filtre-categorie`, `fix/57-badge-prix-barre`, `chore/60-update-deps`.
Le `<type>` reprend les mêmes préfixes que les commits (section suivante), pour retrouver facilement à quoi sert la branche.

### 3. Commits

Les messages de commit sont validés automatiquement par un hook `commit-msg` (husky + commitlint, config [`commitlint.config.js`](./commitlint.config.js)) — un commit qui ne respecte pas le format est **rejeté**.

Format : [Conventional Commits](https://www.conventionalcommits.org/)

```
<type>(<scope optionnel>): <description au présent, sans majuscule ni point final>
```

Types autorisés : `feat`, `fix`, `refactor`, `perf`, `style`, `test`, `docs`, `build`, `ci`, `chore`, `revert`.

```bash
git commit -m "feat(products): ajouter le filtre par catégorie"
git commit -m "fix(cart): corriger le calcul du total avec remise"
git commit -m "docs: documenter le workflow issue/PR/commit"
```

⚠️ Le hook ne s'exécute qu'en local (`git commit`). Un merge/squash fait depuis l'interface GitHub ne le déclenche pas — vérifier que le **titre de la PR** respecte aussi ce format quand le squash-merge est utilisé, puisque GitHub reprend ce titre comme message du commit final.

### 4. Pull Requests

Toujours cibler `dev`, jamais `staging` ni `master` directement.

```bash
git push -u origin <nom-de-branche>
gh pr create \
  --base dev \
  --title "feat(products): ajouter le filtre par catégorie" \
  --body "Closes #42"
```

- Le titre suit le même format que les commits (voir avertissement ci-dessus).
- `Closes #<numero>` dans la description ferme automatiquement l'issue liée au merge.
- Une fois mergée, supprimer la branche (`gh pr merge --delete-branch` ou depuis l'UI).

### 5. Intégration continue (CI)

Chaque PR vers `dev`, `staging` ou `master` déclenche automatiquement (`.github/workflows/ci.yml`) :

- **Lint, typecheck, tests** — `pnpm lint`, `pnpm typecheck` (`tsc --noEmit`) et `pnpm test`. Une PR qui casse l'un des trois est bloquée.
- **Format du titre de la PR** — vérifié indépendamment des commits, puisque c'est ce titre que GitHub reprend comme message de commit lors d'un squash-merge (voir l'avertissement à la section Commits ci-dessus).

Pour reproduire les mêmes vérifications en local avant de pousser :

```bash
pnpm lint
pnpm typecheck
pnpm test
```
