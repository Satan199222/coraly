# Audit technique — 12 avril 2026

## Résumé exécutif

Le projet est globalement sain : build Next.js OK, tests unitaires OK, et base TypeScript solide.  
Les principaux axes d'amélioration concernent surtout la **qualité continue** (formatage automatisé), la **robustesse CSS** (2 warnings de build) et l'**industrialisation CI**.

## Vérifications réalisées

- `npm run lint` : passe avec 1 warning initial (import non utilisé).
- `npm test` : 38 tests passants.
- `npm run build` : build OK avec 2 warnings CSS pendant l'optimisation.

## Améliorations appliquées immédiatement

1. Ajout d'un script de formatage:

   - `format`: `eslint --fix .`
   - Objectif: fournir une commande standard de nettoyage codebase.

2. Correction d'un warning lint:

   - Suppression d'un import `screen` inutilisé dans `faq-accordion.test.tsx`.

## Recommandations prioritaires (prochain sprint)

### 1) Stabiliser la pipeline de qualité

- Ajouter une CI (GitHub Actions) qui exécute systématiquement:
  - `npm ci`
  - `npm run format` (ou `npm run lint` selon stratégie)
  - `npm test`
  - `npm run build`
- Bénéfice: détection précoce des régressions avant merge.

### 2) Éliminer les warnings CSS de build

- Les warnings `var(--...)` indiquent qu'au moins une classe arbitraire Tailwind est mal interprétée.
- Action recommandée:
  - isoler la/les classes dynamiques concernées,
  - remplacer les constructions ambiguës par des classes explicites ou styles inline typés,
  - vérifier que la génération CSS est exempte de warning en build.

### 3) Renforcer la qualité sur les composants critiques

- Cibler en priorité les composants à forte complexité interactionnelle (`courses/page`, flux conversation, panier).
- Ajouter des tests d'intégration (ex. Testing Library + scénarios utilisateur complets):
  - ajout produit,
  - remplacement produit,
  - validation panier,
  - reprise après erreur API.

### 4) Améliorer l'observabilité côté API

- Uniformiser les logs d'erreurs API (`/api/search`, `/api/cart`, `/api/stores`, etc.) avec:
  - corrélation request-id,
  - message utilisateur vs message technique,
  - niveau de sévérité.
- Bénéfice: diagnostic plus rapide en production.

### 5) Préparer le durcissement accessibilité

- Le positionnement produit est déjà orienté accessibilité.
- Étape suivante: intégrer des audits automatisés (`axe`, pa11y ou équivalent) dans la CI.
- Ajouter au moins 1 test a11y par composant clé (dialogues, formulaires, navigation clavier).

## Impact attendu

- Moins de bruit qualité en PR (format + lint propre).
- Moins de risque de régression fonctionnelle (tests + CI).
- Meilleure fiabilité perçue et meilleure maintenabilité long terme.
