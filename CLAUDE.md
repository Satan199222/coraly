# VoixCourses — Conventions projet

## Stack

- **Next.js 16** (App Router) · **React 19** · **TypeScript** strict
- **Tailwind v4** (config dans `globals.css`, pas de `tailwind.config.*`)
- **Vitest** + `@testing-library/react` pour les tests unitaires
- **ElevenLabs React SDK** pour le mode conversation
- Police **Luciole** via `next/font/local` — variable CSS `--font-luciole`

## Design system

Palette Marine éditorial — tokens CSS définis dans `globals.css` :

| Token | Usage |
|---|---|
| `--bg` | Fond principal (cream `#F4EEE3` en thème clair) |
| `--text` | Texte principal (ink `#0D1B2A`) |
| `--accent` | Couleur d'action (marine `#1E3A5F`) |
| `--brass` | Accentuation (laiton `#B58842`) |
| `--accent-ink` | Fond foncé des blocs premium |
| `--text-soft` / `--text-muted` | Corps / métadonnées |
| `--border` / `--border-hi` | Séparateurs |
| `--bg-surface` / `--bg-card` | Surfaces élevées |
| `--success` / `--danger` | Feedback état |

Classes utilitaires : `vc-h1`, `vc-h2`, `vc-eyebrow` (définis dans `globals.css`).

Thèmes : `clair` (défaut), `sombre`, `jaune-noir` (DMLA), `blanc-bleu` (glaucome).  
Appliqués via classe `theme-*` sur `<html>`.

## Structure des pages

Chaque page doit respecter cette hiérarchie de landmarks pour WCAG AAA :

```
<AccessibilityBar />   ← role="region"
<LiveRegion />         ← aria-live, hors main
<SiteHeader />         ← <header> implicite, doit être au niveau racine
<main id="main" tabIndex={-1}>
  {contenu de la page}
</main>
<Footer />             ← <footer role="contentinfo">, doit être au niveau racine
<HelpDialog />         ← dialog, peut être n'importe où
```

**Ne jamais** envelopper `<SiteHeader>` ou `<Footer>` dans `<main>` —
les navigateurs suppriment les rôles `banner` et `contentinfo` quand ils sont
imbriqués dans `<main>`.

Le `layout.tsx` racine ne doit **pas** contenir de `<main>` — chaque page
définit le sien.

## Règles d'accessibilité (WCAG AAA non-négociable)

- Tout `aria-label` sur un `<div>` non-interactif exige `role="region"` (ou un rôle ARIA sémantique).
- `role="status"` / `aria-live` : placer **uniquement** sur l'élément qui porte le texte dynamique — jamais sur un wrapper qui contient aussi du texte visible fixe (double annonce).
- `role="group"` sur `<details>` est invalide. Utiliser `<details>` natif sans rôle.
- Chaque page doit avoir exactement **un** `<h1>`. Utiliser `className="sr-only"` si visiblement superflu.
- Tout clic de navigation inter-page → `router.push()` (Next.js), **jamais** `window.location.href` (détruit les `LiveRegion` en cours de lecture).
- Les éléments `inert` reçoivent `inert={boolean}` (prop React 19, pas d'attribut HTML string).

## localStorage / sessionStorage

Toujours protéger les accès dans un try/catch — private browsing et certains browsers en mode kiosque lancent des exceptions.

```ts
// Pattern recommandé (voir accessibility-bar.tsx)
function safeLocalGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeLocalSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); }
  catch (err) { console.warn(`[ctx] localStorage.setItem(${key}) failed:`, err); }
}
```

## Gestion des erreurs / logging

**Règle** : aucun `catch {}` vide ni `.catch(() => {})` sans console.

| Contexte | Niveau |
|---|---|
| Erreur récupérable (autoplay, API non-critique) | `console.warn("[module] message:", err)` |
| Erreur critique (fetch raté, logique brisée) | `console.error("[module] message:", err)` |
| Silencing volontaire documenté | Commentaire explicatif obligatoire |

Préfixe de namespace dans tous les logs : `[speech]`, `[welcome]`, `[beep]`, `[conversation]`, `[a11y]`, etc.

## Speech / TTS

- `useSpeech` : signature `{ rate, lang, premiumVoice }`, retourne `speak: (text: string) => Promise<void>`.
- `useWelcomeAudio` : joue "Bonjour, je suis Koraly." une fois par session (sessionStorage guard). Délai 600 ms pour compatibilité autoplay.
- Toujours `cancelSpeech()` avant `startListening()` — micro + TTS simultanés = cacophonie.
- `onerror` des `SpeechRecognition` et `SpeechSynthesisUtterance` doivent loguer `event.error`.

## Tests

- Framework : Vitest + `@testing-library/react`
- Tester les **comportements** (ce que l'utilisateur voit / entend), pas l'implémentation.
- Pas de mock de `localStorage` / `sessionStorage` — utiliser les vrais (JSDOM les fournit).
- Timer : `vi.useFakeTimers()` dans `beforeEach`, `vi.useRealTimers()` dans `afterEach`.
- Pas de `getAllByRole("group")` sur `<details>` — utiliser `container.querySelectorAll("details")`.
- Un test par comportement observable, nommé en français (`"ne parle pas si voiceEnabled est false"`).

## Commits

Format Conventional Commits :

```
type(scope): description courte en français

feat, fix, refactor, test, docs, chore, a11y
```

Exemples :
- `feat(home): ajouter raccourcis 1/2/3 vers les modes`
- `fix(a11y): corriger role="status" dans KoralyOrb`
- `a11y(layout): déplacer <main> hors du layout racine`

## Ne pas faire

- Pas de `window.location.href` pour la navigation interne → `router.push()`
- Pas de `localStorage.getItem/setItem` sans try/catch
- Pas de `catch {}` vide
- Pas de `role="group"` sur `<details>`
- Pas de `aria-label` sans rôle sur un `<div>` non-interactif
- Pas de `<header>` ou `<footer>` dans `<main>`
- Pas de `<main>` dans `layout.tsx` racine
