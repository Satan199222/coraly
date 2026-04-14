# Conventions partagées — Projets Julien

Ce fichier contient les conventions de CODE à appliquer. Les procédures admin (Grafana dashboards, Doppler setup, Sentry dashboard, onboarding) sont dans `ADMIN_PROCEDURES.md` — les consulter uniquement quand l'utilisateur demande une opération admin.

## Comment ce fichier fonctionne

### Synchronisation

- Ce fichier (`CLAUDE_SHARED.md`) est **synchronisé automatiquement** depuis le repo [`dev-conventions`](https://github.com/satan199222/dev-conventions).
- Un hook Claude Code (`SessionStart`) le re-télécharge à chaque démarrage. **Tu as toujours la dernière version.**
- **Ne pas modifier ce fichier directement dans un projet.** Si une convention doit changer, modifie la source dans `dev-conventions` et push :
  ```bash
  cd ~/projects/dev-conventions && git pull
  # modifier CLAUDE_SHARED.md
  git add CLAUDE_SHARED.md && git commit -m "fix: update conventions" && git push
  ```
  Le hook SessionStart re-télécharge ce fichier via `gh api` (repo privé, authentifié).
- Les conventions **spécifiques au projet** sont dans `CLAUDE.md` (jamais écrasé par le sync).

### Onboarding — Après injection dans un nouveau projet

Quand ce fichier apparaît pour la première fois dans un projet :

1. **Lis `CLAUDE.md`** du projet pour comprendre le contexte spécifique
2. **Applique les conventions ci-dessous** à tout le code que tu écris
3. **Vérifie la conformité** du projet avec ces conventions (stack, structure, patterns)
4. **Signale les écarts** si le projet ne respecte pas une convention — ne corrige pas sans demander

### Priorité des instructions

1. **Instructions directes de l'utilisateur** — priorité maximale
2. **`CLAUDE.md` du projet** — conventions locales spécifiques
3. **`CLAUDE_SHARED.md` (ce fichier)** — conventions globales partagées
4. **Comportement par défaut de Claude Code**

En cas de conflit entre `CLAUDE.md` et `CLAUDE_SHARED.md`, le `CLAUDE.md` local gagne toujours.

---

## Règles fondamentales

### Context7

**Toujours utiliser Context7 via MCP pour consulter la documentation officielle avant d'utiliser une lib ou une API.** Ne jamais se fier uniquement à la mémoire ou aux connaissances de training. Cela s'applique à toutes les libs du stack.

### Best practices — Standard d'abord

**Toujours privilégier les solutions standard, natives et recommandées** avant d'écrire du custom. Cette règle s'applique à tout le stack :

- **UI** : utiliser les composants shadcn/ui tels quels avant de créer un composant custom
- **Next.js** : utiliser les API natives (metadata, next/image, next/font, sitemap.ts, Route Handlers) — pas de lib tierce si le natif couvre le besoin
- **Infra** : préférer les intégrations Vercel Marketplace / services managés plutôt que du self-hosted
- **Prisma/tRPC** : utiliser les middlewares et patterns natifs, pas de wrappers custom inutiles
- **Général** : si une lib du stack fournit une feature, l'utiliser plutôt que réinventer

Si un besoin ne peut pas être couvert par le standard, le custom est OK **à condition de justifier par un commentaire** dans le code expliquant pourquoi le standard ne convient pas.

### Règles Claude Code

- **Toujours consulter Context7** avant d'écrire du code qui utilise une lib externe
- **Toujours utiliser `AskUserQuestion`** pour poser des questions — ne jamais poser de questions en texte libre dans la conversation
- **Lancer lint + typecheck après chaque modification** : `pnpm lint && pnpm tsc --noEmit`
- **Commiter après chaque étape fonctionnelle** — commits atomiques, pas de gros commits monolithiques
- **Faire un backup (branche ou stash) avant tout refacto majeur** — ne jamais refactorer sur la branche de travail sans filet
- **Écrire un test pour chaque bug fixé** — le test doit reproduire le bug avant le fix, puis passer après
- **Ne jamais supprimer de fichier ou de bloc de code significatif sans demander** — commenter ou marquer DEBT si c'est de la dette, mais ne pas supprimer silencieusement

---

## Stack technique

- **Framework** : Next.js (App Router)
- **Langage** : TypeScript (strict mode)
- **Monorepo** : Turborepo (un repo GitHub par produit, organisé en monorepo avec packages internes)
- **API** : tRPC
- **ORM** : Prisma
- **DB** : Neon (PostgreSQL, branching par environnement)
- **Auth** : Better Auth + CASL (autorisations)
- **Env validation** : t3-env (Zod, validation au build)
- **i18n** : next-intl
- **Paiements** : Stripe (Connect pour les marketplaces)
- **UI** : Tailwind CSS + shadcn/ui
- **Package manager** : pnpm
- **Formatting** : Prettier intégré dans ESLint (eslint-plugin-prettier)
- **Git hooks** : Husky + lint-staged (lint + format avant chaque commit)
- **Déploiement** : Vercel
- **Secrets** : Doppler (environnements : dev, staging, prd, test)
- **Error tracking** : Sentry (un projet par app)
- **Monitoring** : Grafana Cloud (compte unique, toutes apps)
- **Analytics** : Vercel Analytics + GA4 + Meta Pixel
- **Consent** : Tarteaucitron Pro (CMP RGPD hébergé)
- **Email templates** : React Email (dans `@mon-app/email`)
- **Notifications app** : Amazon SES + Knock
- **Notifications alertes** : Email + Telegram (bot perso)
- **Bot / Messaging** : Telegram Bot API + Mini App
- **Storage fichiers** : Vercel Blob / Uploadthing
- **Tests E2E** : Playwright
- **Tests unitaires** : Vitest
- **CI/CD** : GitHub Actions + Vercel
- **License** : UNLICENSED (propriétaire)

---

## Turborepo — Structure monorepo

Chaque produit/application a son propre repo GitHub, organisé en monorepo Turborepo avec ses packages internes.

### Structure standard

```
mon-app/
├── apps/
│   └── web/                # App Next.js principale
├── packages/
│   ├── ui/                 # Composants shadcn/ui partagés
│   ├── db/                 # Schema Prisma + client partagé
│   ├── config/             # ESLint, TSConfig, Prettier partagés
│   ├── email/              # Templates email partagés
│   └── monitoring/         # Config Sentry + métriques Grafana
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── CLAUDE.md
└── CLAUDE_SHARED.md
```

### Règles

- Package naming : `@mon-app/nom-du-package`
- Dépendances internes : `"workspace:*"`
- Tâches cachées par Turborepo : `build`, `lint`, `test` (pas `dev`)
- Chaque package exporte via `exports` dans son `package.json`

### Packages internes standard

| Package                  | Rôle                                                          |
| ------------------------ | ------------------------------------------------------------- |
| `@mon-app/ui`            | Composants shadcn/ui + helper `cn()`                          |
| `@mon-app/db`            | Schema Prisma, client, migrations, types générés              |
| `@mon-app/config`        | Config ESLint (+ Prettier), TSConfig de base                  |
| `@mon-app/notifications` | Service Knock (workflows, types, templates Liquid versionnés) |
| `@mon-app/monitoring`    | Config Sentry, helpers métriques Grafana, health check        |

---

## Naming — Convention de nommage des services

### Règle de base

Tous les noms suivent le **kebab-case**, aligné sur le nom du repo GitHub.

| Service                       | Convention                   | Exemple                                      |
| ----------------------------- | ---------------------------- | -------------------------------------------- |
| **Repo GitHub**               | kebab-case                   | `prono-pro`                                  |
| **Neon — projet**             | kebab-case                   | `prono-pro`                                  |
| **Neon — branches**           | noms fixes                   | `main`, `staging`, `test`                    |
| **Doppler — projet**          | kebab-case                   | `prono-pro`                                  |
| **Doppler — envs**            | noms fixes                   | `dev`, `staging`, `prd`, `test`              |
| **Sentry — projet**           | kebab-case                   | `prono-pro`                                  |
| **Vercel — projet**           | kebab-case                   | `prono-pro`                                  |
| **Knock — workflows**         | kebab-case                   | `welcome-email`, `subscription-confirmation` |
| **Stripe — products**         | Nom lisible                  | `Prono Pro — Premium Monthly`                |
| **Stripe — price lookup_key** | kebab-case                   | `prono-pro-premium-monthly`                  |
| **Stripe — metadata**         | toujours `app: "nom-app"`    | `app: "prono-pro"`                           |
| **Telegram — bots**           | Libre (contrainte BotFather) | —                                            |

---

## Structure de dossiers (dans `apps/web/`)

```
apps/web/src/
├── app/
│   ├── (public)/           # Routes publiques
│   ├── (auth)/             # Auth
│   ├── (app)/              # Routes authentifiées
│   ├── (admin)/            # Back office
│   └── api/
│       ├── webhooks/
│       ├── trpc/
│       ├── health/
│       └── cron/
├── server/
│   ├── routers/
│   ├── trpc.ts
│   └── root.ts
├── lib/
│   ├── stripe.ts
│   ├── telegram.ts
│   ├── email.ts
│   ├── metrics.ts
│   └── utils.ts
├── components/
│   ├── ui/
│   └── [feature]/
├── hooks/
├── types/
├── i18n/                   # Config next-intl + messages
│   ├── request.ts
│   └── messages/
│       ├── fr.json
│       └── en.json
└── styles/

scripts/
e2e/
├── fixtures/
├── helpers/
├── pages/
├── front-office/
├── back-office/
└── integrations/
```

---

## Conventions de code

### Naming

- **Fichiers** : kebab-case (`user-profile.tsx`)
- **Composants React** : PascalCase (`UserProfile`)
- **Hooks** : camelCase préfixé `use` (`useSubscription`)
- **Types/Interfaces** : PascalCase, pas de préfixe `I`
- **Variables/fonctions** : camelCase
- **Constantes globales** : UPPER_SNAKE_CASE
- **Routes tRPC** : camelCase, verbe d'action (`user.getById`)
- **Variables d'env** : UPPER*SNAKE_CASE, `NEXT_PUBLIC*` uniquement si côté client
- **Migrations Prisma** : nommées par description (`add-user-subscription-fields`, `create-telegram-tables`)

### Imports

Ordre : 1) React/Next, 2) Libs externes, 3) `@mon-app/*`, 4) `@/server`, 5) `@/lib`, 6) `@/components`, 7) `@/hooks`, 8) `@/types`, 9) Relatifs. Toujours `@/` pour les imports internes, `@mon-app/` pour les packages.

### TypeScript

- **Jamais de `any`** — `unknown` + type guard si nécessaire
- `any` temporaire → `// DEBT: [code-quality] — any à typer`
- Types Prisma générés (depuis `@mon-app/db`), pas de redéfinition
- `as const` pour les littéraux

### Formatting

- Prettier intégré dans ESLint via `eslint-plugin-prettier`
- Config partagée dans `packages/config`
- Husky + lint-staged : formatting vérifié avant chaque commit

### Composants React

- Functional components uniquement
- Props typées inline si ≤ 3 props, interface séparée sinon
- Un composant par fichier
- Pas de logique métier dans les composants

---

## Variables d'environnement — t3-env

### Validation obligatoire au build

Chaque projet utilise `@t3-oss/env-nextjs` pour valider les variables d'environnement avec Zod. Le build crashe si une variable manque ou est invalide.

### Structure standard

```typescript
// src/env.ts
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    DIRECT_URL: z.string().url(),
    AUTH_SECRET: z.string().min(1),
    STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
    STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
    DOPPLER_ENVIRONMENT: z.enum(['dev', 'staging', 'prd', 'test']),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
    NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().startsWith('G-'),
    NEXT_PUBLIC_META_PIXEL_ID: z.string().min(1),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
    NEXT_PUBLIC_META_PIXEL_ID: process.env.NEXT_PUBLIC_META_PIXEL_ID,
  },
});
```

### Validation au build (next.config.ts)

```typescript
// Next.js 15+ : import direct (TypeScript natif dans next.config.ts)
import './src/env';
```

### Règles

- **Toujours importer depuis `~/env`** ou `@/env`, jamais `process.env` directement
- Chaque nouvelle variable d'env doit être ajoutée dans `env.ts` avec sa validation Zod
- Les variables Doppler doivent correspondre au schéma t3-env
- Le build échoue si une variable manque → pas de bug runtime lié aux env vars

---

## Base de données — Prisma

### Connexion Neon (serverless)

Deux URLs obligatoires pour chaque environnement :

```dotenv
# Connexion poolée — utilisée par Prisma Client (app)
DATABASE_URL="postgres://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require"

# Connexion directe — utilisée par Prisma CLI (migrations)
DIRECT_URL="postgres://user:pass@ep-xxx.region.aws.neon.tech/neondb"
```

### Singleton PrismaClient

Évite les fuites de connexions en dev (hot reload) et en serverless :

```typescript
// packages/db/src/client.ts
import { PrismaClient } from '../generated/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

### Soft delete

**Soft delete par défaut.** Toutes les entités principales ont un champ `deletedAt` :

```prisma
model User {
  id        String    @id @default(cuid())
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime? // soft delete
}
```

- Les queries doivent toujours filtrer `where: { deletedAt: null }` (utiliser un middleware Prisma ou un helper)
- Hard delete uniquement pour les données techniques sans valeur métier (sessions, tokens, logs temporaires)
- Prévoir un job de purge pour supprimer définitivement les données soft-deleted après X jours (RGPD)

### Enums

**Enums définis dans Prisma** (enum natif PostgreSQL) :

```prisma
enum SubscriptionStatus {
  ACTIVE
  PAST_DUE
  CANCELED
  EXPIRED
}

model Subscription {
  status SubscriptionStatus @default(ACTIVE)
}
```

- Les types sont automatiquement générés par Prisma et utilisables côté TypeScript
- Nommage des enums : PascalCase
- Nommage des valeurs : UPPER_SNAKE_CASE

### Migrations

- Nommage descriptif : `npx prisma migrate dev --name add-user-subscription-fields`
- Jamais de migration manuelle en prod — toujours via `prisma migrate deploy`
- Revue des migrations SQL générées avant de commit

### Champs standard

Toutes les entités principales incluent :

```prisma
createdAt DateTime  @default(now())
updatedAt DateTime  @updatedAt
deletedAt DateTime? // soft delete
```

---

## i18n — next-intl

### Config

- Fichiers de messages dans `src/i18n/messages/` : `fr.json`, `en.json`
- Français comme langue par défaut
- Clés de traduction en dot notation : `auth.login.title`, `billing.plan.premium`

### Règles

- Jamais de texte en dur dans les composants — toujours `useTranslations()`
- Les clés de traduction suivent la structure des routes/features
- Les messages d'erreur et de succès sont aussi traduits
- Si un projet n'a pas besoin de i18n, le setup reste en place avec FR uniquement (prêt à étendre)

### Routing next-intl

```typescript
// src/i18n/routing.ts
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['fr', 'en'],
  defaultLocale: 'fr',
});
```

---

## Auth — Better Auth + CASL

### Config standard

```typescript
// packages/auth/src/auth.ts (ou src/lib/auth.ts)
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { organization } from 'better-auth/plugins';
import { prisma } from '@mon-app/db';

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  session: {
    cookieCache: { enabled: true, maxAge: 5 * 60 }, // 5 min cache
  },
  rateLimit: {
    window: 60,
    max: 100,
  },
  emailAndPassword: { enabled: true },
  plugins: [
    organization(), // rôles par défaut : owner, admin, member
  ],
});

export type Session = typeof auth.$Infer.Session;
```

### Client auth

```typescript
// src/lib/auth-client.ts
import { createAuthClient } from 'better-auth/react';
import { organizationClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  plugins: [organizationClient()],
});
```

### Route handler

```typescript
// src/app/api/auth/[...all]/route.ts
import { auth } from '@mon-app/auth';
import { toNextJsHandler } from 'better-auth/next-js';

export const { GET, POST } = toNextJsHandler(auth);
```

### CASL — Autorisations

CASL gère les permissions métier (qui peut faire quoi sur quoi). Intégré avec Prisma via `@casl/prisma`. Chaque projet a un package `@mon-app/permissions` dédié.

```typescript
// packages/permissions/src/abilities.ts
import { AbilityBuilder } from '@casl/ability';
import { createPrismaAbility } from '@casl/prisma';
import { Prisma } from '@mon-app/db';
import type { Session } from '@mon-app/auth';

type AppAbility = ReturnType<typeof createPrismaAbility<[string, Prisma.ModelName]>>;

export function defineAbilityFor(session: Session): AppAbility {
  const { can, cannot, build } = new AbilityBuilder(createPrismaAbility);
  const userId = session.user.id;
  const role = session.user.role; // Nécessite un champ `role` dans le schema User ou le plugin admin de Better Auth

  // Tous les users authentifiés
  can('read', 'Post', { deletedAt: null });
  can('create', 'Post');
  can('update', 'Post', { authorId: userId });
  can('delete', 'Post', { authorId: userId });

  // Admin
  if (role === 'admin') {
    can('manage', 'all');
  }

  return build();
}
```

### Utilisation dans tRPC

```typescript
import { accessibleBy } from "@casl/prisma";

// Dans un router tRPC
getAll: protectedProcedure.query(async ({ ctx }) => {
  const ability = defineAbilityFor(ctx.session);
  return ctx.db.post.findMany({
    where: {
      AND: [accessibleBy(ability).Post, { deletedAt: null }],
    },
  });
}),
```

### Règles Auth

- **Better Auth** avec `prismaAdapter` pour persister users/sessions/organizations en DB
- **Cookie-based sessions** avec cache côté serveur (5 min)
- Rate limiting intégré sur les endpoints auth
- CASL dans un package dédié `@mon-app/permissions`
- Défense en profondeur : proxy/middleware (auth check) + tRPC procedures (CASL check)
- Jamais de vérification de permissions côté client uniquement
- Organizations plugin si multi-tenant

---

## Proxy / Middleware — Auth + i18n

### Pattern avec Better Auth (Next.js 16 = `proxy.ts`)

```typescript
// src/proxy.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

const publicPages = ['/', '/login', '/register'];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Routes API et fichiers statiques : skip
  if (pathname.startsWith('/api') || pathname.startsWith('/_next')) {
    return NextResponse.next();
  }

  // Routes publiques : i18n uniquement
  const isPublic = publicPages.some((p) => new RegExp(`^(/(fr|en))?${p}$`).test(pathname));
  if (isPublic) return intlMiddleware(req);

  // Routes protégées : vérifier le cookie de session Better Auth
  const sessionCookie = req.cookies.get('better-auth.session_token');
  if (!sessionCookie) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return intlMiddleware(req);
}

export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
};
```

### Règles

- Next.js 16 utilise `proxy.ts` (renommé depuis `middleware.ts`)
- Le proxy combine auth (cookie Better Auth) + i18n (next-intl)
- Les routes API et fichiers statiques sont exclues via le matcher
- Vérification légère du cookie côté proxy, validation complète côté tRPC
- Si un projet n'a pas d'i18n, le proxy fait uniquement l'auth check

---

## Patterns tRPC

### Structure d'un router

```typescript
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '@/server/trpc';
import { TRPCError } from '@trpc/server';

export const exampleRouter = createTRPCRouter({
  getById: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const item = await ctx.db.example.findUnique({
      where: { id: input.id, deletedAt: null },
    });
    if (!item) throw new TRPCError({ code: 'NOT_FOUND' });
    return item;
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.example.create({
        data: { ...input, userId: ctx.session.user.id },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Soft delete
      return ctx.db.example.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      });
    }),
});
```

### Règles

- Inputs validés avec Zod (même les IDs)
- `protectedProcedure` par défaut
- Vérifier ownership, pas juste l'auth
- Ne jamais retourner de données sensibles
- `TRPCError` avec bons codes
- Toujours filtrer `deletedAt: null` dans les queries
- Pas de try/catch qui avale les erreurs

---

## Patterns Stripe

### Webhooks — structure obligatoire

```typescript
import { headers } from 'next/headers';
import Stripe from 'stripe';

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response('Invalid signature', { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed':
      break;
    case 'customer.subscription.updated':
      break;
    case 'customer.subscription.deleted':
      break;
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return new Response('OK', { status: 200 });
}
```

### Règles

- **Toujours vérifier la signature webhook**
- Mode test pour dev/staging/test
- Connect : `application_fee_amount` pour les commissions
- Montants en centimes
- `customer_id` stocké sur le user en DB
- Idempotence via `event.id` ou status en DB
- Metadata : toujours `app: "nom-de-l-app"`

---

## Patterns Telegram

### Bot API

- Bot de prod ET bot de test (via @BotFather)
- Webhook sécurisé avec secret token
- Valider `X-Telegram-Bot-Api-Secret-Token`

### Mini App — Validation `initData` obligatoire côté serveur

```typescript
import crypto from 'crypto';

function validateInitData(initData: string, botToken: string): boolean {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  return hash === expectedHash;
}
```

### Modèle single-group

- Un seul groupe par tipster/créateur
- Picks gratuits et premium coexistent
- Accès premium via permissions du groupe

---

## Gestion d'erreur

### Serveur

- `TRPCError` pour les erreurs attendues
- Erreurs inattendues → Sentry automatiquement
- Webhooks retournent 200 pour les événements traités ou ignorés ; 400 uniquement si la signature est invalide

### Client

- `error.tsx` au niveau `app/(app)/` minimum
- `not-found.tsx` personnalisé
- `loading.tsx` ou Suspense
- Mutations tRPC : `onError` → toast

### Interdit

- ❌ `catch (e) { console.log(e) }`
- ❌ `catch (e) { return null }`
- ❌ try/catch trop large

---

## Sécurité

### Auth

- Routes protégées par middleware + vérification tRPC (défense en profondeur)
- Rôle admin vérifié côté serveur
- `AUTH_SECRET` unique par environnement

### Webhooks

- Toujours vérifier la signature

### Inputs

- Zod partout
- Sanitiser les entrées (XSS)

### Données sensibles

- Jamais de secret dans `NEXT_PUBLIC_*`
- Variables d'env dans Doppler uniquement
- Pas de `.env` commité

---

## Caching — Stratégie de rendu

### Matrice de décision

| Cas                                                | Stratégie          | Config                              |
| -------------------------------------------------- | ------------------ | ----------------------------------- |
| Page publique statique (landing, CGU)              | **SSG**            | `generateStaticParams()`            |
| Page publique avec données (blog, catalogue)       | **ISR**            | `export const revalidate = 60`      |
| Page authentifiée (dashboard, profil)              | **SSR**            | `cache: 'no-store'` ou pas de cache |
| Données qui changent rarement (config, catégories) | **ISR long**       | `revalidate = 3600`                 |
| Données temps réel (chat, notifications)           | **Client**         | `useQuery` tRPC avec polling/SSE    |
| Mutations (formulaires, actions)                   | **Server Actions** | `'use server'` + `revalidatePath`   |

### Règles

- Par défaut, les Server Components cachent les données (`force-cache`)
- Utiliser `revalidatePath()` ou `revalidateTag()` après une mutation pour invalider le cache
- Ne jamais cacher les données utilisateur spécifiques (panier, profil, sessions)
- ISR pour les pages publiques avec données : bon compromis performance/fraîcheur
- Tester la stratégie de cache en staging avant de passer en prod

---

## Logging structuré

### Format standard

```typescript
// Utiliser un logger structuré (pino ou winston)
logger.info('User signed up', {
  userId: user.id,
  email: user.email,
  source: 'telegram',
  app: 'prono-pro',
});

logger.error('Stripe webhook failed', {
  eventId: event.id,
  eventType: event.type,
  error: err.message,
  app: 'prono-pro',
});
```

### Règles

- Logs structurés en JSON (pas de `console.log` en prod)
- Toujours inclure : `app`, contexte métier (userId, eventId, etc.)
- Niveaux : `error` (erreurs), `warn` (situations anormales), `info` (événements métier), `debug` (dev uniquement)
- Pas de données sensibles dans les logs (pas de tokens, mots de passe, données perso complètes)
- `console.log` / `console.error` acceptés en dev uniquement — le lint doit catcher en CI

---

## Commits & Branching

### Conventional Commits

Format : `type(scope): description`

Types : `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `style`, `perf`, `ci`

### Branching

- `main` — production, **protégée** (pas de push direct)
- `feat/nom` — nouvelle fonctionnalité
- `fix/nom` — correction de bug
- `hotfix/nom` — correction urgente (depuis `main`)

### Règles

- **Jamais de push direct sur `main`** — toujours passer par une PR
- Commits atomiques
- Pas de "WIP" sur main
- Squash merge pour les PRs

### Git hooks (Husky + lint-staged)

Installés automatiquement par `dev-conventions/sync.sh` :

- **`pre-commit`** : lint-staged — lint uniquement les fichiers modifiés (rapide)
- **`pre-push`** : bloque tout push direct sur `main` avec message explicite

```json
// lint-staged config dans package.json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": ["eslint --fix"]
  }
}
```

---

## CI/CD — GitHub Actions

Le workflow CI est installé automatiquement par `dev-conventions/sync.sh` dans `.github/workflows/ci.yml`.
Il est **adaptatif** : détecte les scripts disponibles dans le projet et ne lance que ce qui existe.

### Sur chaque PR (vers main)

| Check | Condition |
|-------|-----------|
| **Lint** | Si script `lint` existe dans package.json |
| **Typecheck** | Si script `typecheck` ou `type-check` existe |

### Build

Géré automatiquement par **Vercel** (preview deploy sur PR, production sur merge). Pas de `pnpm build` en CI.

### Tests E2E (optionnel, manuel)

Déclenchés à la demande via `workflow_dispatch` dans GitHub Actions. Pas systématiques pour économiser les minutes CI.

### Workflow standard

```yaml
name: CI
on:
  pull_request:
    branches: [main]
  workflow_dispatch:
    inputs:
      run_e2e:
        description: "Lancer les tests E2E"
        type: boolean
        default: false

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Lint
        run: |
          if jq -e '.scripts.lint' package.json >/dev/null 2>&1; then
            pnpm lint
          fi
      - name: Typecheck
        run: |
          if jq -e '.scripts.typecheck' package.json >/dev/null 2>&1; then
            pnpm typecheck
          fi

  e2e:
    if: github.event.inputs.run_e2e == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm test:e2e
```

---

## Sentry

### Organisation

- **Org** : `groupe-j`
- Un **projet Sentry par app** (ex: `pronostic-web`, `pronostic-bot`, `ridesamui-t3`)
- Auth token partagé : `GROUPEJ_SENTRY_TOKEN` (dans Doppler de chaque projet)

### Variables d'environnement

```bash
SENTRY_DSN=""                    # Server-side DSN (jamais hardcodé !)
NEXT_PUBLIC_SENTRY_DSN=""        # Client-side DSN (public)
SENTRY_AUTH_TOKEN=""             # Pour source maps upload (CI/build)
SENTRY_ORG="groupe-j"           # Organisation Sentry
SENTRY_PROJECT=""                # Nom du projet Sentry
```

**JAMAIS de DSN hardcodé dans le code** — toujours via `process.env`.

### sentry.server.config.ts (standard)

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  profilesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  enabled: process.env.NODE_ENV !== "test",
});
```

### sentry.client.config.ts (standard)

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  integrations: [],
  enabled: process.env.NODE_ENV !== "test",

  // Filtrage du bruit — erreurs non-actionnables
  ignoreErrors: [
    "NEXT_NOT_FOUND",
    "NEXT_REDIRECT",
    "AbortError",
    "NetworkError",
    "Failed to fetch",
    "Load failed",
    "ChunkLoadError",
    "ResizeObserver loop",
    /hydration/i,
  ],
  denyUrls: [
    /extensions\//i,
    /^chrome:\/\//i,
    /^moz-extension:\/\//i,
  ],
});

// Lazy-load Replay pour ne pas bloquer le rendu initial
if (typeof window !== "undefined") {
  requestIdleCallback(() => {
    import("@sentry/nextjs").then((SentryModule) => {
      SentryModule.addIntegration(
        SentryModule.replayIntegration({
          maskAllText: false,
          blockAllMedia: false,
        })
      );
    });
  });
}
```

### sentry.edge.config.ts (standard)

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  enabled: process.env.NODE_ENV !== "test",
});
```

### instrumentation.ts (standard)

```typescript
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
```

### next.config.ts — withSentryConfig (standard)

```typescript
import { withSentryConfig } from "@sentry/nextjs";

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: true,
  tunnelRoute: "/monitoring",
});
```

### Sampling — Règles

| Contexte | tracesSampleRate | profilesSampleRate | replaysSession | replaysOnError |
|----------|-----------------|-------------------|----------------|----------------|
| **Production** | 0.1 (10%) | 0.1 (10%) | 0.1 (10%) | 1.0 (100%) |
| **Dev/Preview** | 1.0 (100%) | 1.0 (100%) | 0 | 0 |
| **Test** | désactivé | désactivé | désactivé | désactivé |

### beforeSend — Contexte enrichi

Chaque projet doit enrichir les événements Sentry avec du contexte métier via `beforeSend`. Ajouter dans `sentry.server.config.ts` et `sentry.client.config.ts` :

```typescript
Sentry.init({
  // ... config standard ...
  beforeSend(event) {
    // Ajouter le contexte métier du projet
    event.tags = {
      ...event.tags,
      app: "nom-du-projet",          // Identifier l'app dans les dashboards
      // Pour les apps multi-tenant :
      // tenantId: getCurrentTenantId(),
    };
    return event;
  },
});
```

Exemples de contexte utile selon le projet :

| Projet | Tags à ajouter |
|--------|----------------|
| pronostic | `app`, `tenantId` (tipster), `plan` (free/pro) |
| ridesamui | `app`, `locale` (th/en/fr) |
| archicollab | `app`, `orgId`, `role` (admin/member) |
| megahote | `app`, `propertyId`, `tenantId` |
| businessfamily | `app` |

### Cron Monitoring

Sentry surveille automatiquement les crons Vercel quand `automaticVercelMonitors: true` est dans `withSentryConfig`. Si un cron ne s'exécute pas à l'heure prévue ou échoue silencieusement, Sentry alerte.

**Déjà activé** via la config `withSentryConfig` standard. Pour les crons custom (pas via `vercel.json`), wrapper manuellement :

```typescript
// Dans un cron handler custom
import * as Sentry from "@sentry/nextjs";

export async function GET() {
  return Sentry.withMonitor("nom-du-cron", async () => {
    // logique du cron
    return Response.json({ ok: true });
  }, {
    schedule: { type: "crontab", value: "*/15 * * * *" },
    checkinMargin: 5,   // minutes de tolérance avant alerte "missed"
    maxRuntime: 10,      // minutes max avant alerte "timeout"
  });
}
```

**Tous les crons doivent être wrappés** avec `Sentry.withMonitor` ou utiliser `automaticVercelMonitors`.

### Alertes (déjà configurées sur les 5 projets)

- Error spike > 10/h → Email
- High priority issue → Email
- Fatal error → Email
- Cron missed/timeout → automatique via `automaticVercelMonitors`

> Configuration des notifications, alertes Telegram, et dashboards : voir `ADMIN_PROCEDURES.md`

---

## Doppler

- Environnements : `dev`, `staging`, `prd`, `test`
- Toute variable d'env passe par Doppler
- Dev : `doppler run -- pnpm dev`
- Tests : `doppler run -c test -- pnpm test:e2e`

### Tokens partagés — Préfixe `GROUPEJ_`

Variables préfixées `GROUPEJ_` = tokens communs à tous les projets. Source de vérité : Doppler pronostic prd.
- `GROUPEJ_GRAFANA_API_TOKEN` — Grafana Cloud
- `GROUPEJ_SENTRY_TOKEN` — Sentry (source maps, releases)
- `GROUPEJ_VERCEL_API_TOKEN` — Vercel API

> Procédure de copie vers un nouveau projet : voir `ADMIN_PROCEDURES.md`

---

## Grafana Cloud

Approche zero-code : Grafana se connecte aux datasources existantes, pas de SDK dans les projets.
Aucun code à écrire pour le monitoring — tout se configure dans le dashboard Grafana.

Env vars liées à Grafana dans Doppler :
- `GROUPEJ_GRAFANA_API_TOKEN` — Token API global
- `GRAFANA_DB_READONLY_PASSWORD` — Password du user Neon `grafana_readonly` (par projet)

> Onboarding Grafana, datasources, queries SQL templates, alertes : voir `ADMIN_PROCEDURES.md`

---

## Tests E2E — Playwright

### 4 types de tests

1. Parcours utilisateur complets
2. Tests de composants isolés
3. Tests API/tRPC (fixture `request`)
4. Tests visuels / screenshots (régression CSS)

### Intégrations

- **Stripe** : vraie API test + `stripe listen`
- **Telegram** : bot de test + tunnel ngrok
- **Auth** : injection de session, `storageState` par rôle

### Config

- Chromium, local, `retries: 0`
- E2E en CI uniquement sur PR vers main

### Scripts

```json
{
  "test:db:reset": "doppler run -c test -- tsx scripts/db-reset.ts",
  "test:db:seed": "doppler run -c test -- tsx scripts/seed-test.ts",
  "test:e2e": "doppler run -c test -- playwright test",
  "test:e2e:ui": "doppler run -c test -- playwright test --ui",
  "test:e2e:setup": "pnpm test:db:reset && pnpm test:db:seed",
  "test:stripe:listen": "stripe listen --forward-to localhost:3000/api/webhooks/stripe"
}
```

### Règles

- Tests indépendants, données seedées
- Pas de `sleep`
- Vérifier absence d'erreur console + réseau

---

## Health check — Endpoint standard

### Structure

```typescript
// src/app/api/health/route.ts
import { prisma } from '@mon-app/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, 'ok' | 'error'> = {};

  // DB
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  // Ajouter d'autres checks selon le projet :
  // checks.stripe = await checkStripe();
  // checks.redis = await checkRedis();

  const healthy = Object.values(checks).every((v) => v === 'ok');

  return Response.json(
    { status: healthy ? 'healthy' : 'degraded', checks, timestamp: new Date().toISOString() },
    { status: healthy ? 200 : 503 }
  );
}
```

### Règles

- Endpoint `/api/health` sur chaque projet
- Vérifie au minimum : DB (Prisma), et les services critiques du projet
- Retourne `200` si tout OK, `503` si un service est down
- Appelé par le cron Vercel `*/5 * * * *` (déjà dans la config standard)
- Le cron health alimente aussi les métriques Grafana (uptime)

---

## Email templates — React Email

### Structure dans `@mon-app/email`

```
packages/email/
├── src/
│   ├── templates/
│   │   ├── welcome.tsx
│   │   ├── reset-password.tsx
│   │   ├── subscription-confirmation.tsx
│   │   └── invoice.tsx
│   ├── components/
│   │   ├── header.tsx
│   │   ├── footer.tsx
│   │   └── button.tsx
│   └── send.ts             # Helper d'envoi (SES / Knock)
├── package.json
└── tsconfig.json
```

### Pattern template

```tsx
// packages/email/src/templates/welcome.tsx
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Heading,
  Text,
  Button,
  Hr,
  Tailwind,
} from '@react-email/components';

interface WelcomeEmailProps {
  name: string;
  appName: string;
  dashboardUrl: string;
}

export default function WelcomeEmail({ name, appName, dashboardUrl }: WelcomeEmailProps) {
  return (
    <Html lang="fr">
      <Tailwind>
        <Head />
        <Preview>Bienvenue sur {appName}</Preview>
        <Body className="bg-gray-100 font-sans">
          <Container className="mx-auto max-w-xl rounded-lg bg-white px-5 py-10">
            <Heading className="mb-6 text-center text-2xl font-bold text-gray-900">
              Bienvenue, {name} !
            </Heading>
            <Text className="mb-4 text-base leading-7 text-gray-600">
              Ton compte sur {appName} est prêt.
            </Text>
            <Button
              href={dashboardUrl}
              className="block rounded bg-indigo-600 px-6 py-3 text-center text-base font-semibold text-white no-underline"
            >
              Accéder au dashboard
            </Button>
            <Hr className="my-6 border-gray-200" />
            <Text className="text-sm text-gray-400">
              Si tu n'as pas créé ce compte, ignore cet email.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

WelcomeEmail.PreviewProps = {
  name: 'Julien',
  appName: 'Mon App',
  dashboardUrl: 'https://mon-app.com/dashboard',
} satisfies WelcomeEmailProps;
```

### Règles

- Chaque template a des `PreviewProps` pour le dev (`npx email dev`)
- Props typées avec une interface TypeScript
- Composants réutilisables (header, footer, button) dans `components/`
- Tailwind pour le style (via le composant `<Tailwind>`)
- Textes en français par défaut, i18n si nécessaire
- Tester le rendu sur les principaux clients email (Gmail, Outlook, Apple Mail)

---

## Database seeding

### Scripts standard

```
scripts/
├── seed-dev.ts              # Données de dev (riches, réalistes)
├── seed-test.ts             # Données de test (minimales, déterministes)
└── db-reset.ts              # Reset complet : drop + migrate + seed
```

### Pattern seed

```typescript
// scripts/seed-dev.ts
import { prisma } from '@mon-app/db';

async function main() {
  console.log('🌱 Seeding database...');

  // Cleanup (respecter l'ordre des FK)
  await prisma.subscription.deleteMany();
  await prisma.user.deleteMany();

  // Users
  const admin = await prisma.user.create({
    data: {
      email: 'admin@test.com',
      name: 'Admin Test',
      role: 'admin',
    },
  });

  const user = await prisma.user.create({
    data: {
      email: 'user@test.com',
      name: 'User Test',
      role: 'user',
    },
  });

  console.log(`✅ Seeded: ${admin.email}, ${user.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

### Règles

- **seed-dev** : données riches et réalistes pour le développement
- **seed-test** : données minimales et déterministes pour les tests E2E
- **db-reset** : reset complet, utilisé avant les tests (`pnpm test:e2e:setup`)
- Les IDs de seed sont stables (pas de `cuid()` aléatoire) pour les tests déterministes
- Exécution via Doppler : `doppler run -- tsx scripts/seed-dev.ts`
- Jamais de seed en production

---

## API error codes — Catalogue d'erreurs métier

### Format standard

```typescript
// src/lib/errors.ts
export const APP_ERRORS = {
  // Auth
  AUTH_001: { code: 'AUTH_001', message: 'Session expirée', httpStatus: 401 },
  AUTH_002: { code: 'AUTH_002', message: 'Permissions insuffisantes', httpStatus: 403 },
  AUTH_003: { code: 'AUTH_003', message: 'Compte désactivé', httpStatus: 403 },

  // Payment
  PAYMENT_001: { code: 'PAYMENT_001', message: 'Paiement échoué', httpStatus: 402 },
  PAYMENT_002: { code: 'PAYMENT_002', message: 'Abonnement expiré', httpStatus: 402 },
  PAYMENT_003: { code: 'PAYMENT_003', message: 'Carte refusée', httpStatus: 402 },

  // Resource
  RESOURCE_001: { code: 'RESOURCE_001', message: 'Ressource non trouvée', httpStatus: 404 },
  RESOURCE_002: { code: 'RESOURCE_002', message: 'Ressource déjà existante', httpStatus: 409 },

  // Validation
  VALIDATION_001: { code: 'VALIDATION_001', message: 'Données invalides', httpStatus: 400 },

  // Rate limit
  RATE_001: { code: 'RATE_001', message: 'Trop de requêtes', httpStatus: 429 },
} as const;

export type AppErrorCode = keyof typeof APP_ERRORS;
```

### Utilisation dans tRPC

```typescript
import { TRPCError } from '@trpc/server';
import { APP_ERRORS } from '@/lib/errors';

throw new TRPCError({
  code: 'FORBIDDEN',
  message: APP_ERRORS.AUTH_002.message,
  cause: { appCode: APP_ERRORS.AUTH_002.code },
});
```

### Règles

- Chaque projet définit son catalogue dans `src/lib/errors.ts`
- Les codes suivent le format `CATEGORIE_XXX`
- Catégories standard : `AUTH`, `PAYMENT`, `RESOURCE`, `VALIDATION`, `RATE`
- Les codes spécifiques au projet s'ajoutent avec des catégories propres
- Les messages sont en français (traduits via i18n si le projet est multilingue)
- Le code d'erreur est retourné au client pour un traitement programmatique

---

## Config Vercel

### Build — Ignored Build Step

Tous les projets monorepo (Turborepo) utilisent `npx turbo-ignore` pour skip les builds quand les fichiers du projet n'ont pas changé. Configuré dans Vercel Project Settings → Git → Ignored Build Step.

Résultat : si tu push un changement dans `apps/web`, seul `apps/web` rebuild. Les autres apps (bot, backoffice, etc.) sont skipées.

Ne PAS configurer sur les projets standalone (un seul app comme businessfamily, jelement).

### Node.js version

Tous les projets utilisent **Node 24.x**. Configuré dans Vercel Project Settings → General → Node.js Version.

### Headers de sécurité

```typescript
headers: async () => [
  {
    source: "/(.*)",
    headers: [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ],
  },
],
```

### Cron

```json
{
  "crons": [
    { "path": "/api/cron/health", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/metrics", "schedule": "*/15 * * * *" }
  ]
}
```

---

## Analytics & Tracking

### Vercel Analytics

- Intégré dans chaque app via `@vercel/analytics`
- Pas de configuration custom nécessaire
- Les données sont dans le dashboard Vercel de chaque projet
- Pour les métriques business custom → Grafana Cloud (pas Vercel Analytics)

### Tags standard — GA4 + Meta Pixel

Chaque projet inclut par défaut :

- **Google Analytics 4** (GA4) — chargé via `next/script` strategy `afterInteractive`
- **Meta Pixel** — chargé via `next/script` strategy `afterInteractive`
- **Vercel Analytics** — via `@vercel/analytics` (first-party, pas soumis au consentement)
- Tout autre tag analytics ou marketing nécessaire

### Consentement — Tarteaucitron Pro (auto-détection)

- **CMP** : Tarteaucitron Pro (service hébergé, conforme RGPD)
- **Tarteaucitron Pro auto-détecte les scripts analytics** sur la page et les bloque automatiquement jusqu'au consentement — pas besoin de configuration manuelle des tags
- Les tags peuvent être chargés normalement (via `next/script`, `<script>`, etc.) — Tarteaucitron Pro les intercepte et gère le consentement
- Le composant `CookieConsent` charge un seul script : `https://tarteaucitron.io/load.js?domain=...&uuid=...`
- Tarteaucitron Pro gère la bannière, le stockage du consentement, et le chargement conditionnel des tags
- Dashboard de gestion : https://opt-out.ferank.eu/

### Variables d'env tracking

```
# UUID du compte Tarteaucitron Pro — depuis le dashboard https://opt-out.ferank.eu/
NEXT_PUBLIC_TARTEAUCITRON_UUID=xxxxxxxxxxxxxxxxxxxxxxxx

# Analytics — chargés normalement, Tarteaucitron Pro gère le consentement automatiquement
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_META_PIXEL_ID=XXXXXXXXXXXXXXXX
```

### Composant CookieConsent (`@mon-app/ui`)

```tsx
// Dans le root layout, avant </body>
<CookieConsent
  uuid={process.env.NEXT_PUBLIC_TARTEAUCITRON_UUID ?? ''}
  domain="mon-domaine.com" // optionnel, auto-détecté sinon
/>
```

### Règles

- Charger les tags analytics normalement (`next/script`, etc.) — Tarteaucitron Pro les intercepte automatiquement
- L'UUID Tarteaucitron est dans Doppler, pas en dur dans le code
- Vercel Analytics (`@vercel/analytics`) est chargé sans consentement (first-party, conforme RGPD)
- Si un tag n'est pas auto-détecté par Tarteaucitron Pro, l'ajouter manuellement dans le dashboard

---

## Images & Assets

### Storage

- **Assets statiques** (logos, icônes, illustrations) : dossier `public/` de Next.js
- **Uploads utilisateur** (avatars, documents, pièces jointes) : **Vercel Blob** ou **Uploadthing**
- Jamais d'uploads user dans `public/`

### Optimisation

- Utiliser `next/image` pour toutes les images affichées
- Toujours fournir `width`, `height` et `alt`
- Formats modernes : WebP ou AVIF quand possible
- Images de plus de 200ko → optimiser avant upload

---

## SEO — Checklist par page publique

Chaque page dans `(public)/` doit avoir :

- [ ] `metadata` exporté (title + description uniques)
- [ ] Open Graph tags (title, description, image)
- [ ] Twitter Card tags
- [ ] URL canonique
- [ ] Balise `h1` unique
- [ ] Images avec attribut `alt`
- [ ] Structured data (JSON-LD) si pertinent (product, article, FAQ)
- [ ] Lien dans le sitemap (`sitemap.ts`)

### Fichiers SEO obligatoires

- `app/sitemap.ts` — sitemap dynamique
- `app/robots.ts` — config robots
- `app/manifest.ts` — PWA manifest (si applicable)
- `app/opengraph-image.tsx` — image OG par défaut

---

## Accessibilité (a11y) — Règles minimum

- Tous les éléments interactifs sont accessibles au clavier (Tab, Enter, Escape)
- Focus visible sur tous les éléments interactifs
- Contraste minimum WCAG AA (4.5:1 pour le texte normal)
- Tous les `<img>` ont un `alt` (vide si décoratif : `alt=""`)
- Les formulaires ont des `<label>` associés à chaque input
- Les modales piègent le focus (focus trap)
- Les messages d'erreur sont liés aux inputs via `aria-describedby`
- Les icônes seules ont un `aria-label`
- Tester avec le lecteur d'écran au moins une fois par feature majeure

---

## UI/UX

### Composants

- **shadcn/ui** comme base (via `@mon-app/ui` ou local)
- Personnaliser via CSS variables
- Composant custom = `components/[feature]/`

### Tailwind

- Mobile-first
- > 5 classes → extraire dans un composant
- `cn()` pour classes conditionnelles
- Pas de `!important`

### États obligatoires

- ⏳ **Loading** : skeleton/spinner
- 📭 **Empty** : message + CTA
- ❌ **Error** : message + action
- ✅ **Success** : toast/feedback

### Responsive

- 3 breakpoints : 375px, 768px, 1280px
- Tableaux → cartes sur mobile
- Nav latérale → hamburger sur mobile

---

## Dépendances

### Quand ajouter une lib

- ✅ Si la lib résout un problème complexe et bien maintenu (Stripe, Prisma, tRPC, next-intl)
- ✅ Si coder soi-même prendrait > 2 jours et que la lib est mature (> 1k stars, mise à jour récente)
- ❌ Si c'est un petit utilitaire qu'on peut écrire en 20 lignes
- ❌ Si la lib a des dépendances lourdes pour un usage mineur
- ❌ Si la lib n'est plus maintenue (dernier commit > 6 mois, issues non répondues)

### Avant d'ajouter une lib

1. Vérifier sur npm : dernière mise à jour, taille du bundle, nombre de dépendances
2. Vérifier la compatibilité avec le stack (Next.js App Router, React Server Components)
3. Consulter la doc via Context7

### Mise à jour des dépendances

- **Minors/patches** : mettre à jour mensuellement (ou quand signalé par Dependabot)
- **Majors** : planifier, lire le changelog, tester — ne pas accumuler le retard
- **Sécurité** : appliquer immédiatement les patches de sécurité (`pnpm audit`)
- Après chaque mise à jour : `pnpm lint && pnpm tsc --noEmit && pnpm test`

---

## README — Convention par projet

Chaque projet doit avoir un README avec au minimum :

```markdown
# Nom du projet

Description courte.

## Stack

[Résumé du stack spécifique]

## Getting started

[Comment lancer le projet en local]

## Commandes

[Liste des commandes pnpm]

## Architecture

[Résumé des choix d'architecture]

## Tests

[Comment lancer les tests]

## Déploiement

[Comment le déploiement fonctionne]
```

---

## Dette technique

### Marquage dans le code

```typescript
// DEBT: [catégorie] — Description
// Impact: ce que ça cause
// Fix: comment résoudre (S/M/L)
```

Catégories : `[security]`, `[architecture]`, `[code-quality]`, `[performance]`, `[infra]`

### Trouver les items

```bash
grep -rn "// DEBT:" src/ apps/ packages/
```

### Règles

- Ne jamais fixer sans demander
- Commentaire au-dessus de la ligne concernée
- Si résolu : supprimer + mettre à jour CLAUDE.md

---

## Performance budget

### Seuils par défaut

| Métrique | Seuil | Outil de mesure |
|----------|-------|-----------------|
| **LCP** (Largest Contentful Paint) | < 2.5s | Vercel Speed Insights |
| **FID** (First Input Delay) | < 100ms | Vercel Speed Insights |
| **CLS** (Cumulative Layout Shift) | < 0.1 | Vercel Speed Insights |
| **TTFB** (Time to First Byte) | < 800ms | Vercel Speed Insights |
| **Bundle JS** (first load) | < 300kb gzipped | `next build` output |
| **API response** (p95) | < 500ms | Sentry Tracing |
| **DB query** (p95) | < 100ms | Sentry Profiling |
| **Build time** | < 3 min | Vercel deploy logs |

### Règles

- **Chaque nouvelle page** doit respecter les Core Web Vitals avant merge
- **Chaque nouvelle API route** : vérifier que le p95 < 500ms après deploy
- **Bundle size** : vérifier le delta dans le output `next build` — un nouveau `use client` component ne doit pas ajouter > 50kb
- Si un seuil est dépassé, créer un item `// DEBT: [performance]` avec le contexte

### Où voir les métriques

| Métrique | Où |
|----------|----|
| Core Web Vitals (real users) | Vercel Dashboard → Speed Insights |
| Bundle size | `next build` → "First Load JS" column |
| API latency | Sentry → Performance → par endpoint |
| DB queries | Sentry → Profiling (quand activé) |
| Grafana | `{projet}-postgres-prod` → query `pg_stat_user_tables` |

---

## Onboarding nouveau projet

> Checklist complète step-by-step : voir `ADMIN_PROCEDURES.md`

Résumé : scaffold T3 → GitHub → Vercel → Neon → Doppler (copier GROUPEJ_*) → Sentry → Grafana → `bash sync.sh`
