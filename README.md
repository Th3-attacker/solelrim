This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

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
