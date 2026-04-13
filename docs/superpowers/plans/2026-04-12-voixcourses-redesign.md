# VoixCourses Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Appliquer la direction visuelle Marine éditorial (spec `docs/superpowers/specs/2026-04-12-voixcourses-design.md`) à l'ensemble du produit : refactor des tokens globaux, ajout de la police Luciole, reconstruction de la home, mise à niveau uniforme des pages `/courses`, `/courses/conversation`, `/installer`.

**Architecture :** Le codebase utilise déjà des CSS custom properties (`var(--bg)`, `var(--text)`, etc.) consommées partout. On change donc les tokens au niveau `globals.css` (effet global immédiat), on charge Luciole via `next/font/local`, on reconstruit la home en sections modulaires, puis on harmonise les autres pages en leur apposant les composants partagés (SiteHeader, Footer refondu, AccessibilityBar simplifiée).

**Tech Stack :** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4 (utilitaires marginaux), Vitest, next/font/local pour Luciole.

**Référence visuelle :** `.superpowers/brainstorm/2955-1776017807/content/home-marine-v2.html` (mockup validé).

---

## File Structure

**Nouveaux fichiers :**
- `src/fonts/luciole/` — Fichiers WOFF2 de Luciole (4 variantes)
- `src/lib/fonts.ts` — Déclaration `next/font/local` pour Luciole
- `src/components/site-header.tsx` — Header commun à toutes les pages
- `src/components/koraly-orb.tsx` — Orbe animée avec ripples
- `src/components/hero-section.tsx` — Hero home
- `src/components/trust-strip.tsx` — Bandeau enseignes
- `src/components/modes-showcase.tsx` — 3 cartes de modes
- `src/components/manifesto-section.tsx` — Manifeste accessibilité
- `src/components/walkthrough-dialog.tsx` — Dialogue en bulles
- `src/components/testimony-section.tsx` — Témoignage utilisateur
- `src/components/faq-accordion.tsx` — FAQ accessibilité
- `src/components/final-cta-section.tsx` — CTA final
- `src/lib/speech/use-welcome-audio.ts` — Hook d'accueil vocal
- `src/components/koraly-orb.test.tsx` — Test unitaire orb
- `src/components/faq-accordion.test.tsx` — Test unitaire FAQ

**Fichiers modifiés :**
- `src/app/globals.css` — Tokens Marine, 4 thèmes, base 18px
- `src/app/theme-init.ts` — Défaut clair, nouveau thème `blanc-bleu`
- `src/app/layout.tsx` — Charger Luciole
- `src/app/page.tsx` — Réécrit pour assembler les sections home
- `src/app/courses/page.tsx` — Utiliser SiteHeader, harmoniser
- `src/app/courses/conversation/page-client.tsx` — Utiliser SiteHeader, harmoniser
- `src/app/installer/page.tsx` — Utiliser SiteHeader + Footer
- `src/components/accessibility-bar.tsx` — 4 thèmes visibles, `aria-pressed`
- `src/components/footer.tsx` — 4 colonnes + badges conformité

---

## Task 1: Récupérer les fichiers de police Luciole

**Files:**
- Create: `src/fonts/luciole/Luciole-Regular.woff2`
- Create: `src/fonts/luciole/Luciole-Bold.woff2`
- Create: `src/fonts/luciole/Luciole-Regular-Italic.woff2`
- Create: `src/fonts/luciole/Luciole-Bold-Italic.woff2`

- [ ] **Step 1: Créer le dossier fonts**

```bash
mkdir -p src/fonts/luciole
```

- [ ] **Step 2: Télécharger les WOFF2 depuis le site officiel CTRDV**

```bash
cd src/fonts/luciole
curl -L -o Luciole-Regular.woff2 https://www.luciole-vision.com/Luciole-Regular.woff2
curl -L -o Luciole-Bold.woff2 https://www.luciole-vision.com/Luciole-Bold.woff2
curl -L -o Luciole-Regular-Italic.woff2 https://www.luciole-vision.com/Luciole-Regular-Italic.woff2
curl -L -o Luciole-Bold-Italic.woff2 https://www.luciole-vision.com/Luciole-Bold-Italic.woff2
```

Si les URLs ci-dessus ne répondent pas (le CDN CTRDV change parfois), fallback : télécharger depuis https://github.com/NextEconomy/luciole-font ou le site officiel luciole-vision.com et copier manuellement les WOFF2 dans `src/fonts/luciole/`.

- [ ] **Step 3: Vérifier les 4 fichiers présents**

```bash
ls -lh src/fonts/luciole/
```
Expected : 4 fichiers .woff2 non-vides (~40-60 Ko chacun).

- [ ] **Step 4: Commit**

```bash
git add src/fonts/luciole/
git commit -m "feat(design): ajout police Luciole (CTRDV) pour accessibilité basse vision"
```

---

## Task 2: Déclarer Luciole via next/font/local

**Files:**
- Create: `src/lib/fonts.ts`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Créer le module de police**

```ts
// src/lib/fonts.ts
import localFont from "next/font/local";

/**
 * Luciole : police conçue par le CTRDV (Centre Technique Régional pour la Déficience
 * Visuelle) avec des utilisateurs malvoyants. Licence SIL Open Font License.
 * https://www.luciole-vision.com/
 */
export const luciole = localFont({
  src: [
    { path: "../fonts/luciole/Luciole-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/luciole/Luciole-Regular-Italic.woff2", weight: "400", style: "italic" },
    { path: "../fonts/luciole/Luciole-Bold.woff2", weight: "700", style: "normal" },
    { path: "../fonts/luciole/Luciole-Bold-Italic.woff2", weight: "700", style: "italic" },
  ],
  variable: "--font-luciole",
  display: "swap",
  preload: true,
});
```

- [ ] **Step 2: Appliquer la variable dans layout.tsx**

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "./theme-init";
import { luciole } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "VoixCourses — Vos courses par la voix",
  description:
    "Faites vos courses en ligne par la voix. Dictez, Koraly compose votre panier. Accessible aux non-voyants, malvoyants et seniors.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={luciole.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-[var(--accent)] focus:text-[var(--bg)] focus:px-4 focus:py-2 focus:rounded"
        >
          Aller au contenu principal
        </a>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Vérifier le build**

```bash
pnpm build
```
Expected : build OK, pas d'erreur sur font loading.

- [ ] **Step 4: Commit**

```bash
git add src/lib/fonts.ts src/app/layout.tsx
git commit -m "feat(design): charger Luciole via next/font/local"
```

---

## Task 3: Réécrire globals.css avec la palette Marine

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Remplacer entièrement globals.css**

```css
/* src/app/globals.css */
@import "tailwindcss";

@source "../**/*.{ts,tsx}";

/* =============================================================
   VOIXCOURSES — DESIGN SYSTEM "MARINE ÉDITORIAL"
   Réf : docs/superpowers/specs/2026-04-12-voixcourses-design.md
   ============================================================= */

/* -- Thème Clair (défaut) ----------------------------------- */
:root {
  --bg:           #F4EEE3;
  --bg-alt:       #ECE2D1;
  --bg-surface:   #FFFFFF;
  --bg-card:      #FFFFFF;

  --text:         #0D1B2A;
  --text-soft:    #3A4A5C;
  --text-muted:   #5E6E78;

  --accent:       #1E3A5F;
  --accent-hover: #0D1B2A;
  --accent-ink:   #0D1B2A;
  --brass:        #B58842;

  --border:       rgba(13, 27, 42, 0.10);
  --border-hi:    rgba(13, 27, 42, 0.20);

  --danger:       #B02232;
  --success:      #1C6E47;
  --focus-ring:   #FFD166;

  --font-size-base: 18px;
  --shadow-sm: 0 1px 2px rgba(13, 27, 42, 0.04);
  --shadow-md: 0 4px 12px rgba(13, 27, 42, 0.06);
  --shadow-lg: 0 10px 28px rgba(13, 27, 42, 0.08);
}

/* -- Thème Sombre ------------------------------------------- */
:root.theme-sombre, body.theme-sombre {
  --bg:           #0D1B2A;
  --bg-alt:       #14263A;
  --bg-surface:   #1A2E42;
  --bg-card:      #14263A;

  --text:         #F4EEE3;
  --text-soft:    #CCD5DF;
  --text-muted:   #8FA0B1;

  --accent:       #B58842;
  --accent-hover: #D4A35A;
  --accent-ink:   #0D1B2A;
  --brass:        #D4A35A;

  --border:       rgba(244, 238, 227, 0.12);
  --border-hi:    rgba(244, 238, 227, 0.22);

  --danger:       #FF6B8A;
  --success:      #2EE8A5;
  --focus-ring:   #FFD166;
}

/* -- Thème Jaune/Noir (DMLA) -------------------------------- */
:root.theme-jaune-noir, body.theme-jaune-noir {
  --bg:           #000000;
  --bg-alt:       #0A0A0A;
  --bg-surface:   #0A0A0A;
  --bg-card:      #0A0A0A;

  --text:         #FFEB00;
  --text-soft:    #FFEB00;
  --text-muted:   #CCBB00;

  --accent:       #FFEB00;
  --accent-hover: #FFFFFF;
  --accent-ink:   #000000;
  --brass:        #FFFFFF;

  --border:       #FFEB00;
  --border-hi:    #FFFFFF;

  --danger:       #FF6666;
  --success:      #66FF66;
  --focus-ring:   #FFFFFF;
}

/* -- Thème Blanc/Bleu (Glaucome) ---------------------------- */
:root.theme-blanc-bleu, body.theme-blanc-bleu {
  --bg:           #003366;
  --bg-alt:       #002244;
  --bg-surface:   #002A55;
  --bg-card:      #002A55;

  --text:         #FFFFFF;
  --text-soft:    #E5ECFF;
  --text-muted:   #AABBDD;

  --accent:       #FFFFFF;
  --accent-hover: #E5ECFF;
  --accent-ink:   #003366;
  --brass:        #FFD166;

  --border:       rgba(255, 255, 255, 0.25);
  --border-hi:    rgba(255, 255, 255, 0.45);

  --danger:       #FFB4C1;
  --success:      #A5E8C6;
  --focus-ring:   #FFD166;
}

/* -- Forced colors (Windows High Contrast) ------------------ */
@media (forced-colors: active) {
  :root {
    --bg: Canvas;
    --bg-alt: Canvas;
    --bg-surface: Canvas;
    --bg-card: Canvas;
    --text: CanvasText;
    --text-soft: CanvasText;
    --text-muted: CanvasText;
    --accent: LinkText;
    --accent-hover: LinkText;
    --accent-ink: Canvas;
    --border: CanvasText;
    --focus-ring: Highlight;
  }
  button, [role="button"], input, textarea, select {
    border: 2px solid ButtonBorder !important;
  }
}

/* -- Reset ---------------------------------------------------- */
* { box-sizing: border-box; }

html { font-size: var(--font-size-base); }

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-luciole), system-ui, -apple-system, sans-serif;
  line-height: 1.65;
  letter-spacing: 0.005em;
  transition: background 0.2s, color 0.2s;
  min-height: 100vh;
}

/* Dégradé décoratif supprimé : palette claire + Luciole = plus de fond dégradé */

/* -- Focus visible AAA -------------------------------------- */
:focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: 3px;
  border-radius: 4px;
}
@media (prefers-contrast: more) {
  :focus-visible { outline-width: 5px; outline-offset: 4px; }
}

/* -- Selection --------------------------------------------- */
::selection { background: var(--accent); color: var(--bg); }

/* -- Reduced motion ---------------------------------------- */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* -- Typographie de base (échelle stricte) ------------------ */
.vc-h1 { font-size: 64px; line-height: 1.02; letter-spacing: -2px; font-weight: 700; }
.vc-h2 { font-size: 40px; line-height: 1.1; letter-spacing: -1.2px; font-weight: 700; }
.vc-h3 { font-size: 22px; line-height: 1.25; letter-spacing: -0.2px; font-weight: 700; }
.vc-body { font-size: 18px; line-height: 1.65; }
.vc-meta { font-size: 15px; line-height: 1.55; }
.vc-micro { font-size: 13px; line-height: 1.5; letter-spacing: 0.15em; text-transform: uppercase; font-weight: 700; }

@media (max-width: 768px) {
  .vc-h1 { font-size: 44px; letter-spacing: -1.2px; }
  .vc-h2 { font-size: 30px; letter-spacing: -0.8px; }
  .vc-h3 { font-size: 20px; }
}

/* -- Eyebrow éditorial -------------------------------------- */
.vc-eyebrow {
  font-size: 13px; font-weight: 700; letter-spacing: 0.25em; text-transform: uppercase;
  color: var(--accent); display: inline-flex; align-items: center; gap: 10px;
}
.vc-eyebrow::before {
  content: ""; width: 28px; height: 1px; background: var(--brass);
}

/* -- Orb animations ---------------------------------------- */
@keyframes vc-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
@keyframes vc-ripple {
  0% { transform: scale(0.9); opacity: 0.8; }
  100% { transform: scale(1.25); opacity: 0; }
}
@keyframes vc-breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.04); }
}

/* -- sr-only ------------------------------------------------ */
.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}

/* -- Placeholder ------------------------------------------- */
::placeholder { color: var(--text-muted); opacity: 1; }
```

- [ ] **Step 2: Lancer le dev server et vérifier la home**

```bash
pnpm dev
```
Ouvrir `http://localhost:3000`. Attendu : fond crème #F4EEE3, texte quasi-noir, Luciole rendue. Ne pas corriger la structure de la page encore — on valide juste les tokens.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(design): palette Marine éditorial + 4 thèmes + base 18px"
```

---

## Task 4: Mettre à jour theme-init.ts

**Files:**
- Modify: `src/app/theme-init.ts`

- [ ] **Step 1: Remplacer le script d'init**

```ts
// src/app/theme-init.ts
/**
 * Script inline appliqué AVANT le premier paint pour éviter le FOWT
 * (Flash of Wrong Theme) et le FOUT sur la taille de police.
 *
 * Thème par défaut : clair (palette Marine éditorial, cream #F4EEE3).
 * Taille par défaut : 18px (base accessible low vision, recommandation WCAG 2.2).
 *
 * Thèmes supportés : sombre, jaune-noir (DMLA), blanc-bleu (glaucome).
 * Le thème "clair" est l'absence de classe.
 */
export const THEME_INIT_SCRIPT = `
(function() {
  try {
    var t = localStorage.getItem('voixcourses-theme');
    if (t === 'sombre' || t === 'jaune-noir' || t === 'blanc-bleu') {
      document.documentElement.classList.add('theme-' + t);
    }
    var s = localStorage.getItem('voixcourses-font-size') || '18px';
    document.documentElement.style.setProperty('--font-size-base', s);
    if (!localStorage.getItem('voixcourses-font-size')) {
      localStorage.setItem('voixcourses-font-size', '18px');
    }
  } catch (e) {}
})();
`.trim();
```

- [ ] **Step 2: Commit**

```bash
git add src/app/theme-init.ts
git commit -m "feat(design): défaut thème clair + base 18px + support blanc-bleu"
```

---

## Task 5: Refactor AccessibilityBar (4 thèmes visibles + Aa)

**Files:**
- Modify: `src/components/accessibility-bar.tsx`

**Contexte :** Le composant existant gère déjà thème/fontsize/voice/diet/rate/locale/help. On garde la logique avancée (diet/rate/locale) dans un dialog replié, on expose dans la barre principale uniquement les 4 thèmes + Aa−/Aa+ + voix. Cela respecte la finesse demandée.

- [ ] **Step 1: Lire le fichier existant pour référence**

```bash
wc -l src/components/accessibility-bar.tsx
```
Retour attendu : ~327 lignes.

- [ ] **Step 2: Remplacer entièrement le composant par cette version (qui préserve l'API existante mais simplifie la surface visible)**

```tsx
// src/components/accessibility-bar.tsx
"use client";

import { useEffect, useState } from "react";
import { useExtension } from "@/lib/extension/use-extension";
import {
  usePreferences,
  type DietaryRestriction,
  type SpeechLocale,
  type SpeechRate,
} from "@/lib/preferences/use-preferences";

interface AccessibilityBarProps {
  onVoiceToggle?: (enabled: boolean) => void;
  onHelpRequest?: () => void;
}

type Theme = "clair" | "sombre" | "jaune-noir" | "blanc-bleu";

const THEME_OPTIONS: { value: Theme; label: string; aria: string }[] = [
  { value: "clair", label: "Clair", aria: "Thème clair (par défaut)" },
  { value: "sombre", label: "Sombre", aria: "Thème sombre" },
  { value: "jaune-noir", label: "Jaune/Noir", aria: "Thème jaune sur noir (recommandé pour DMLA)" },
  { value: "blanc-bleu", label: "Blanc/Bleu", aria: "Thème blanc sur bleu (recommandé pour glaucome)" },
];

const FONT_SIZES = ["16px", "18px", "22px", "28px"] as const;

const DIET_OPTIONS: { value: DietaryRestriction; label: string }[] = [
  { value: "sans-gluten", label: "Sans gluten" },
  { value: "sans-lactose", label: "Sans lactose" },
  { value: "vegan", label: "Végan" },
  { value: "vegetarien", label: "Végétarien" },
  { value: "halal", label: "Halal" },
  { value: "casher", label: "Casher" },
];
const RATE_OPTIONS: { value: SpeechRate; label: string }[] = [
  { value: "slow", label: "Lent" },
  { value: "normal", label: "Normal" },
  { value: "fast", label: "Rapide" },
];
const LOCALE_OPTIONS: { value: SpeechLocale; label: string }[] = [
  { value: "fr-FR", label: "France" },
  { value: "fr-BE", label: "Belgique" },
  { value: "fr-CH", label: "Suisse" },
  { value: "fr-CA", label: "Canada" },
];

export function AccessibilityBar({
  onVoiceToggle,
  onHelpRequest,
}: AccessibilityBarProps = {}) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "clair";
    return (localStorage.getItem("voixcourses-theme") as Theme) || "clair";
  });
  const [fontSize, setFontSize] = useState<string>(() => {
    if (typeof window === "undefined") return "18px";
    return localStorage.getItem("voixcourses-font-size") || "18px";
  });
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("voixcourses-voice-enabled");
    return saved === null ? true : saved === "true";
  });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const extension = useExtension();
  const { prefs, update } = usePreferences();

  useEffect(() => { onVoiceToggle?.(voiceEnabled); /* eslint-disable-next-line */ }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("theme-sombre", "theme-jaune-noir", "theme-blanc-bleu");
    if (theme !== "clair") root.classList.add(`theme-${theme}`);
    localStorage.setItem("voixcourses-theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty("--font-size-base", fontSize);
    localStorage.setItem("voixcourses-font-size", fontSize);
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem("voixcourses-voice-enabled", String(voiceEnabled));
    onVoiceToggle?.(voiceEnabled);
  }, [voiceEnabled, onVoiceToggle]);

  const currentSizeIdx = FONT_SIZES.indexOf(fontSize as typeof FONT_SIZES[number]);

  return (
    <div
      role="region"
      aria-label="Préférences d'accessibilité"
      className="flex items-center justify-between gap-4 flex-wrap px-6 py-3"
      style={{
        background: "var(--accent-ink)",
        color: "var(--bg)",
        fontSize: "15px",
      }}
    >
      <div className="flex items-center gap-3 font-semibold">
        <span
          aria-hidden="true"
          className="inline-flex items-center justify-center w-7 h-7 rounded-full border-2 text-sm font-bold"
          style={{ borderColor: "var(--bg)" }}
        >Aa</span>
        <span>Confort de lecture</span>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Taille */}
        <button
          aria-label="Diminuer la taille du texte"
          onClick={() => setFontSize(FONT_SIZES[Math.max(0, currentSizeIdx - 1)])}
          className="px-3 py-1.5 rounded border text-sm font-semibold"
          style={{ borderColor: "rgba(244,238,227,0.3)", color: "var(--bg)" }}
        >Aa −</button>
        <button
          aria-label="Augmenter la taille du texte"
          onClick={() => setFontSize(FONT_SIZES[Math.min(FONT_SIZES.length - 1, currentSizeIdx + 1)])}
          className="px-3 py-1.5 rounded border text-sm font-semibold"
          style={{ borderColor: "rgba(244,238,227,0.3)", color: "var(--bg)" }}
        >Aa +</button>

        <span aria-hidden="true" className="opacity-40 mx-1">·</span>

        {/* Thèmes */}
        {THEME_OPTIONS.map(opt => (
          <button
            key={opt.value}
            aria-label={opt.aria}
            aria-pressed={theme === opt.value}
            onClick={() => setTheme(opt.value)}
            className="px-3 py-1.5 rounded border text-sm font-semibold"
            style={{
              borderColor: theme === opt.value ? "var(--brass)" : "rgba(244,238,227,0.3)",
              background: theme === opt.value ? "var(--brass)" : "transparent",
              color: theme === opt.value ? "var(--accent-ink)" : "var(--bg)",
              fontWeight: theme === opt.value ? 700 : 600,
            }}
          >{opt.label}</button>
        ))}

        <span aria-hidden="true" className="opacity-40 mx-1">·</span>

        {/* Voix */}
        <button
          aria-pressed={voiceEnabled}
          onClick={() => setVoiceEnabled(v => !v)}
          className="px-3 py-1.5 rounded border text-sm font-semibold"
          style={{
            borderColor: voiceEnabled ? "var(--brass)" : "rgba(244,238,227,0.3)",
            background: voiceEnabled ? "var(--brass)" : "transparent",
            color: voiceEnabled ? "var(--accent-ink)" : "var(--bg)",
          }}
        >🔊 Voix {voiceEnabled ? "active" : "coupée"}</button>

        {/* Préférences avancées (diet/rate/locale) */}
        <button
          onClick={() => setAdvancedOpen(o => !o)}
          aria-expanded={advancedOpen}
          className="px-3 py-1.5 rounded border text-sm font-semibold"
          style={{ borderColor: "rgba(244,238,227,0.3)", color: "var(--bg)" }}
        >⚙ Préférences</button>

        {onHelpRequest && (
          <button
            onClick={onHelpRequest}
            aria-label="Ouvrir l'aide (raccourci : ?)"
            className="px-3 py-1.5 rounded border text-sm font-semibold"
            style={{ borderColor: "rgba(244,238,227,0.3)", color: "var(--bg)" }}
          >? Aide</button>
        )}
      </div>

      {/* Panel avancé repliable */}
      {advancedOpen && (
        <div
          role="group"
          aria-label="Préférences avancées"
          className="w-full mt-3 pt-3 border-t flex flex-wrap gap-4 text-sm"
          style={{ borderColor: "rgba(244,238,227,0.2)" }}
        >
          <label className="flex items-center gap-2">
            Vitesse voix :
            <select
              value={prefs.speechRate}
              onChange={e => update({ speechRate: e.target.value as SpeechRate })}
              className="bg-transparent border rounded px-2 py-1"
              style={{ borderColor: "rgba(244,238,227,0.3)", color: "var(--bg)" }}
            >
              {RATE_OPTIONS.map(o => <option key={o.value} value={o.value} style={{ color: "#000" }}>{o.label}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2">
            Accent :
            <select
              value={prefs.speechLocale}
              onChange={e => update({ speechLocale: e.target.value as SpeechLocale })}
              className="bg-transparent border rounded px-2 py-1"
              style={{ borderColor: "rgba(244,238,227,0.3)", color: "var(--bg)" }}
            >
              {LOCALE_OPTIONS.map(o => <option key={o.value} value={o.value} style={{ color: "#000" }}>{o.label}</option>)}
            </select>
          </label>
          <fieldset className="flex flex-wrap gap-2 items-center">
            <legend className="mr-2">Régime :</legend>
            {DIET_OPTIONS.map(d => {
              const active = prefs.dietaryRestrictions.includes(d.value);
              return (
                <label key={d.value} className="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={e => {
                      const next = e.target.checked
                        ? [...prefs.dietaryRestrictions, d.value]
                        : prefs.dietaryRestrictions.filter(v => v !== d.value);
                      update({ dietaryRestrictions: next });
                    }}
                  />
                  <span>{d.label}</span>
                </label>
              );
            })}
          </fieldset>
          {extension.installed && (
            <span className="ml-auto opacity-80">
              🧩 Extension {extension.version ?? "installée"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Adapter le thème sombre historique (nom `dark` → `sombre`)**

Rechercher d'anciennes références potentielles :

```bash
grep -rn "theme-dark\|theme-high-contrast\|theme-light" src/ 2>/dev/null
```
Expected : uniquement dans `accessibility-bar.tsx` (après refacto, aucune référence) et `globals.css` (après refacto, absent). Sinon, remplacer manuellement par `theme-sombre` / `theme-jaune-noir`.

- [ ] **Step 4: Commit**

```bash
git add src/components/accessibility-bar.tsx
git commit -m "feat(a11y): barre simplifiée — 4 thèmes visibles, préférences avancées repliables"
```

---

## Task 6: Reconstruire Footer (4 colonnes)

**Files:**
- Modify: `src/components/footer.tsx`

- [ ] **Step 1: Remplacer le footer**

```tsx
// src/components/footer.tsx
import Link from "next/link";

const COL_PRODUIT = [
  { label: "Comment ça marche", href: "/#modes" },
  { label: "Enseignes partenaires", href: "/#enseignes" },
  { label: "Extension Chrome", href: "/installer" },
  { label: "Tarifs", href: "/#tarifs" },
];
const COL_A11Y = [
  { label: "Déclaration de conformité", href: "/accessibilite" },
  { label: "Raccourcis clavier", href: "/accessibilite#raccourcis" },
  { label: "Police Luciole", href: "https://www.luciole-vision.com/", external: true },
  { label: "Signaler un problème", href: "mailto:contact@voixcourses.fr" },
];
const COL_COMPANY = [
  { label: "À propos", href: "/a-propos" },
  { label: "Presse", href: "/presse" },
  { label: "Contact", href: "mailto:contact@voixcourses.fr" },
  { label: "Partenaires enseignes", href: "/b2b" },
];

export function Footer() {
  return (
    <footer
      role="contentinfo"
      className="mt-24"
      style={{ background: "var(--accent-ink)", color: "var(--bg)" }}
    >
      <div className="max-w-[1200px] mx-auto px-10 pt-14 pb-8">
        <div className="grid gap-12 mb-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <div className="text-2xl font-bold flex items-baseline gap-3.5" style={{ letterSpacing: "-0.6px" }}>
              <span>VoixCourses</span>
              <span style={{ color: "var(--brass)", fontSize: "26px", lineHeight: 1 }}>.</span>
              <span
                className="pl-3.5 border-l text-[12px] font-semibold uppercase"
                style={{ letterSpacing: "2.5px", borderColor: "rgba(244,238,227,0.2)", color: "rgba(244,238,227,0.6)" }}
              >par Koraly</span>
            </div>
            <p className="mt-5 text-[15px] leading-[1.6] max-w-[320px]" style={{ color: "rgba(244,238,227,0.7)" }}>
              L&apos;assistante vocale d&apos;accessibilité pour les courses en ligne. Conçue en France avec des utilisateurs déficients visuels.
            </p>
          </div>
          <FooterCol title="Produit" items={COL_PRODUIT} />
          <FooterCol title="Accessibilité" items={COL_A11Y} />
          <FooterCol title="Entreprise" items={COL_COMPANY} />
        </div>

        <div
          className="pt-7 border-t flex justify-between items-center flex-wrap gap-4 text-[14px]"
          style={{ borderColor: "rgba(244,238,227,0.1)", color: "rgba(244,238,227,0.65)" }}
        >
          <div>VoixCourses · 2026 · Moselle, France</div>
          <div className="inline-flex items-center gap-2.5 flex-wrap">
            <span className="px-2.5 py-1 border rounded text-[12px] font-bold tracking-[1px]" style={{ borderColor: "rgba(181,136,66,0.5)", color: "var(--brass)" }}>RGAA AAA</span>
            <span className="px-2.5 py-1 border rounded text-[12px] font-bold tracking-[1px]" style={{ borderColor: "rgba(181,136,66,0.5)", color: "var(--brass)" }}>EAA 2025</span>
            <span>Police Luciole CTRDV · Pantone Cloud Dancer 2026</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, items }: { title: string; items: Array<{ label: string; href: string; external?: boolean }> }) {
  return (
    <div>
      <h5 className="text-[13px] uppercase font-bold mb-4" style={{ letterSpacing: "2px", color: "var(--brass)" }}>{title}</h5>
      <ul className="flex flex-col gap-2.5 list-none">
        {items.map(it => (
          <li key={it.label}>
            {it.external ? (
              <a href={it.href} target="_blank" rel="noopener noreferrer" className="text-[15px] hover:text-[var(--bg)]" style={{ color: "rgba(244,238,227,0.85)" }}>{it.label}</a>
            ) : (
              <Link href={it.href} className="text-[15px] hover:text-[var(--bg)]" style={{ color: "rgba(244,238,227,0.85)" }}>{it.label}</Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/footer.tsx
git commit -m "feat(design): footer 4 colonnes + badges conformité RGAA/EAA"
```

---

## Task 7: Créer SiteHeader (header commun à toutes les pages)

**Files:**
- Create: `src/components/site-header.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
// src/components/site-header.tsx
import Link from "next/link";

interface SiteHeaderProps {
  /** Afficher ou non la nav complète. Sur les pages produit on la réduit. */
  compact?: boolean;
}

/**
 * Header commun à toutes les pages : logo + sous-titre "par Koraly" + nav.
 * Utilise les tokens var(--text), var(--brass), etc. — s'adapte automatiquement
 * aux 4 thèmes.
 */
export function SiteHeader({ compact = false }: SiteHeaderProps = {}) {
  return (
    <header
      className="flex justify-between items-center px-10 py-6 border-b flex-wrap gap-4"
      style={{ borderColor: "var(--border)", color: "var(--text)" }}
    >
      <Link href="/" className="flex items-baseline gap-3.5 no-underline" style={{ color: "var(--text)" }}>
        <span className="text-2xl font-bold" style={{ letterSpacing: "-0.6px" }}>VoixCourses</span>
        <span style={{ color: "var(--brass)", fontSize: "28px", lineHeight: 1, marginLeft: "-2px" }}>.</span>
        <span
          className="pl-3.5 border-l text-[12px] font-semibold uppercase"
          style={{ letterSpacing: "2.5px", borderColor: "var(--border)", color: "var(--text-muted)" }}
        >par Koraly</span>
      </Link>
      {!compact && (
        <nav aria-label="Navigation principale" className="flex gap-8 text-base font-semibold">
          <Link href="/#modes" className="pb-1 border-b-2 border-transparent hover:border-[var(--accent)]">Comment ça marche</Link>
          <Link href="/#enseignes" className="pb-1 border-b-2 border-transparent hover:border-[var(--accent)]">Enseignes</Link>
          <Link href="/#a11y" className="pb-1 border-b-2 border-transparent hover:border-[var(--accent)]">Accessibilité</Link>
          <Link href="/installer" className="pb-1 border-b-2 border-transparent hover:border-[var(--accent)]">Extension</Link>
        </nav>
      )}
    </header>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/site-header.tsx
git commit -m "feat(design): SiteHeader commun avec logo + par Koraly + nav"
```

---

## Task 8: Créer KoralyOrb (orbe animée)

**Files:**
- Create: `src/components/koraly-orb.tsx`
- Create: `src/components/koraly-orb.test.tsx`

- [ ] **Step 1: Écrire le test d'abord**

```tsx
// src/components/koraly-orb.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KoralyOrb } from "./koraly-orb";

describe("KoralyOrb", () => {
  it("rend le nom Koraly comme label visuel", () => {
    render(<KoralyOrb />);
    expect(screen.getByText("Koraly")).toBeInTheDocument();
  });

  it("expose un label accessible décrivant le statut", () => {
    render(<KoralyOrb status="listening" />);
    expect(screen.getByRole("status")).toHaveTextContent(/écoute/i);
  });

  it("affiche 'prête' si statut idle", () => {
    render(<KoralyOrb status="idle" />);
    expect(screen.getByRole("status")).toHaveTextContent(/prête/i);
  });
});
```

- [ ] **Step 2: Lancer le test (doit échouer)**

```bash
pnpm vitest run src/components/koraly-orb.test.tsx
```
Expected : FAIL, module introuvable.

- [ ] **Step 3: Créer le composant**

```tsx
// src/components/koraly-orb.tsx
"use client";

export type KoralyOrbStatus = "idle" | "listening" | "speaking";

interface KoralyOrbProps {
  status?: KoralyOrbStatus;
  size?: number;
}

const STATUS_LABEL: Record<KoralyOrbStatus, string> = {
  idle: "Koraly est prête à vous écouter",
  listening: "Koraly vous écoute",
  speaking: "Koraly parle",
};

/**
 * Orbe visuelle animée représentant Koraly. Respiration + 2 ripples.
 * Respecte prefers-reduced-motion via globals.css.
 */
export function KoralyOrb({ status = "idle", size = 180 }: KoralyOrbProps) {
  const animation = status === "listening" ? "vc-breathe 2.4s ease-in-out infinite" : undefined;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-full"
        style={{
          background: "radial-gradient(circle at 35% 35%, #2A4F7E 0%, var(--accent-ink) 70%)",
          animation,
        }}
      />
      {/* Ripples */}
      <span
        aria-hidden="true"
        className="absolute rounded-full pointer-events-none"
        style={{
          inset: "-16px", border: "1px solid rgba(181,136,66,0.4)",
          animation: "vc-ripple 2.6s ease-out infinite",
        }}
      />
      <span
        aria-hidden="true"
        className="absolute rounded-full pointer-events-none"
        style={{
          inset: "-28px", border: "1px solid rgba(181,136,66,0.2)",
          animation: "vc-ripple 2.6s ease-out 0.8s infinite",
        }}
      />
      <div
        role="status"
        aria-live="polite"
        className="absolute inset-0 flex items-center justify-center text-center"
        style={{ color: "var(--bg)" }}
      >
        <div>
          <div className="text-xl font-bold" style={{ letterSpacing: "-0.3px" }}>Koraly</div>
          <div className="sr-only">{STATUS_LABEL[status]}</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Lancer le test (doit passer)**

```bash
pnpm vitest run src/components/koraly-orb.test.tsx
```
Expected : 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/koraly-orb.tsx src/components/koraly-orb.test.tsx
git commit -m "feat(design): KoralyOrb animée avec états accessibles"
```

---

## Task 9: Créer HeroSection

**Files:**
- Create: `src/components/hero-section.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
// src/components/hero-section.tsx
"use client";

import Link from "next/link";
import { KoralyOrb } from "./koraly-orb";

interface HeroSectionProps {
  onListenDemo?: () => void;
}

/**
 * Hero de la home. h1 64px, lede 21px, CTA principal vers /courses,
 * orb Koraly avec transcript d'exemple, raccourcis clavier affichés.
 */
export function HeroSection({ onListenDemo }: HeroSectionProps = {}) {
  return (
    <section className="py-20 lg:py-24">
      <div className="max-w-[1200px] mx-auto px-10 grid gap-16 items-center lg:grid-cols-[1.15fr_1fr]">
        <div>
          <span className="vc-eyebrow">Accessibilité première · Conforme AAA</span>
          <h1 className="vc-h1 mt-5 mb-6" style={{ color: "var(--text)" }}>
            Vos courses,<br />par la voix.
          </h1>
          <p className="text-[21px] leading-[1.55] max-w-[540px] mb-8" style={{ color: "var(--text-soft)" }}>
            Dites ce que vous voulez. Koraly compose votre panier chez Carrefour, Auchan, Monoprix et d&apos;autres. Clavier, vocal guidé ou conversation libre — vous choisissez votre confort, à tout moment.
          </p>

          <div className="flex gap-3.5 flex-wrap items-center">
            <Link
              href="/courses"
              className="px-7 py-4 rounded-md font-bold text-base inline-flex items-center gap-2.5"
              style={{ background: "var(--accent)", color: "var(--bg)", letterSpacing: "0.3px" }}
            >Commencer mes courses</Link>
            <button
              onClick={onListenDemo}
              className="px-6 py-3.5 rounded-md font-bold text-base bg-transparent border-[1.5px] inline-flex items-center gap-2.5"
              style={{ borderColor: "var(--text)", color: "var(--text)" }}
            >🔊 Écouter la démonstration</button>
          </div>

          <div className="mt-6 text-[15px] flex flex-wrap gap-5" style={{ color: "var(--text-muted)" }} aria-label="Raccourcis clavier">
            <span className="inline-flex items-center gap-1.5"><Kbd>Espace</Kbd> parler à Koraly</span>
            <span className="inline-flex items-center gap-1.5"><Kbd>Tab</Kbd> naviguer</span>
            <span className="inline-flex items-center gap-1.5"><Kbd>Échap</Kbd> arrêter</span>
          </div>
        </div>

        <div
          className="relative p-12 rounded-2xl overflow-hidden"
          style={{ background: "var(--accent-ink)", color: "var(--bg)" }}
          aria-label="Démonstration de Koraly"
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(circle at 30% 20%, rgba(181,136,66,0.25), transparent 55%)" }}
          />
          <div className="relative flex flex-col items-center text-center gap-5">
            <span className="text-[13px] font-bold uppercase inline-flex items-center gap-2" style={{ letterSpacing: "2px", color: "var(--brass)" }}>
              <span className="w-2 h-2 rounded-full" style={{ background: "var(--brass)", animation: "vc-pulse 2s ease-in-out infinite" }} />
              Koraly écoute
            </span>
            <KoralyOrb status="listening" />
            <p className="text-[17px] leading-[1.5] italic max-w-[380px]">
              « Bonjour, je suis Koraly. Dites-moi ce dont vous avez besoin. »
            </p>
            <p className="text-[15px]" style={{ color: "rgba(244,238,227,0.7)" }}>
              <strong style={{ color: "var(--bg)", fontWeight: 700, fontStyle: "normal" }}>Vous :</strong> « Pommes Golden, lait demi-écrémé, pain complet. »
            </p>
            <button
              onClick={onListenDemo}
              className="mt-2 px-4 py-2 rounded-md border-[1.5px] font-bold text-sm inline-flex items-center gap-2"
              style={{ borderColor: "var(--brass)", color: "var(--bg)" }}
            >▶ Écouter la voix de Koraly</button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="inline-block px-2 py-0.5 border-[1.5px] rounded text-sm font-bold"
      style={{ borderColor: "var(--border-hi)", background: "var(--bg-card)", color: "var(--text)", fontFamily: "ui-monospace, monospace" }}
    >{children}</kbd>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/hero-section.tsx
git commit -m "feat(design): HeroSection avec Koraly orb, CTAs et raccourcis clavier"
```

---

## Task 10: Créer TrustStrip

**Files:**
- Create: `src/components/trust-strip.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
// src/components/trust-strip.tsx
const ENSEIGNES = ["Carrefour", "Auchan", "Monoprix", "Franprix", "Intermarché"];

export function TrustStrip() {
  return (
    <section
      id="enseignes"
      aria-label="Enseignes disponibles"
      className="py-7 border-y"
      style={{ background: "var(--bg-alt)", borderColor: "var(--border)" }}
    >
      <div className="max-w-[1200px] mx-auto px-10 flex justify-between items-center gap-8 flex-wrap">
        <div className="vc-micro" style={{ color: "var(--text-muted)", letterSpacing: "2.5px" }}>Disponible chez</div>
        <div className="flex gap-9 items-center flex-wrap">
          {ENSEIGNES.map(e => (
            <span key={e} className="text-lg font-bold opacity-70" style={{ color: "var(--text-soft)", letterSpacing: "-0.3px" }}>{e}</span>
          ))}
          <span className="text-lg font-bold opacity-40" style={{ color: "var(--text-soft)" }}>+ bientôt</span>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/trust-strip.tsx
git commit -m "feat(design): TrustStrip bandeau enseignes"
```

---

## Task 11: Créer ModesShowcase

**Files:**
- Create: `src/components/modes-showcase.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
// src/components/modes-showcase.tsx
import Link from "next/link";

interface Mode {
  icon: string;
  title: string;
  shortcut: string;
  description: string;
  features: string[];
  ideal: string;
  href: string;
  featured?: boolean;
}

const MODES: Mode[] = [
  {
    icon: "⌨",
    title: "Mode Clavier",
    shortcut: "Touche 1",
    description: "Saisissez, naviguez et validez entièrement au clavier. Sans voix si vous préférez le silence.",
    features: [
      "Compatible NVDA, JAWS, VoiceOver, TalkBack",
      "Focus doublé (ring + outline) — jamais perdu",
      "Raccourcis documentés, aide en ligne",
    ],
    ideal: "Idéal · utilisateurs confirmés screen reader",
    href: "/courses",
  },
  {
    icon: "🎙",
    title: "Vocal guidé",
    shortcut: "Touche 2",
    description: "Koraly vous demande, vous dictez un produit, elle confirme. Rythme maîtrisé, pas de confusion.",
    features: [
      "Un produit à la fois, confirmation vocale",
      "Bip aigu au début, grave à la fin d'écoute",
      "Relecture complète du panier avant validation",
    ],
    ideal: "Le plus populaire · premiers utilisateurs",
    href: "/courses?voice=on",
    featured: true,
  },
  {
    icon: "💬",
    title: "Conversation libre",
    shortcut: "Touche 3",
    description: "Parlez comme à une vendeuse. Koraly comprend, propose, ajuste les quantités en continu.",
    features: [
      "Dialogue naturel, sans commandes figées",
      "Mémoire des achats précédents",
      "Interruption possible à tout moment",
    ],
    ideal: "Idéal · utilisateurs à l'aise avec la voix",
    href: "/courses/conversation",
  },
];

export function ModesShowcase() {
  return (
    <section id="modes" className="py-24 lg:py-28" style={{ background: "var(--bg)" }}>
      <div className="max-w-[1200px] mx-auto px-10">
        <div className="grid gap-12 items-end mb-14 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <span className="vc-eyebrow">Trois modes</span>
            <h2 className="vc-h2 mt-4" style={{ color: "var(--text)" }}>
              Choisissez votre manière<br />de faire les courses.
            </h2>
          </div>
          <p className="text-[17px] leading-[1.55]" style={{ color: "var(--text-soft)" }}>
            Chaque profil a ses préférences. Koraly s&apos;adapte — et vous pouvez basculer entre les modes à tout moment. Vos réglages sont mémorisés entre deux visites.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {MODES.map(m => <ModeCard key={m.title} mode={m} />)}
        </div>
      </div>
    </section>
  );
}

function ModeCard({ mode }: { mode: Mode }) {
  const bg = mode.featured ? "var(--accent-ink)" : "var(--bg-card)";
  const color = mode.featured ? "var(--bg)" : "var(--text)";
  const descColor = mode.featured ? "rgba(244,238,227,0.88)" : "var(--text-soft)";
  const idealColor = mode.featured ? "var(--brass)" : "var(--text-muted)";
  const borderColor = mode.featured ? "var(--accent-ink)" : "var(--border)";
  const idealBorder = mode.featured ? "rgba(244,238,227,0.2)" : "var(--border)";
  const markBg = mode.featured ? "rgba(181,136,66,0.18)" : "var(--bg-alt)";

  return (
    <Link
      href={mode.href}
      className="flex flex-col p-9 rounded-xl border relative no-underline transition-transform hover:-translate-y-0.5"
      style={{ background: bg, color, borderColor, boxShadow: mode.featured ? "var(--shadow-lg)" : undefined }}
    >
      <span
        className="absolute top-5 right-5 px-2.5 py-1 rounded border-[1.5px] text-xs font-bold"
        style={{
          fontFamily: "ui-monospace, monospace",
          borderColor: mode.featured ? "rgba(244,238,227,0.4)" : "var(--border-hi)",
          background: mode.featured ? "transparent" : "var(--bg-card)",
          color,
        }}
      >{mode.shortcut}</span>

      <div
        className="w-13 h-13 rounded-xl flex items-center justify-center text-2xl mb-6"
        aria-hidden="true"
        style={{ background: markBg, color: mode.featured ? "var(--brass)" : "var(--text)", width: 52, height: 52 }}
      >{mode.icon}</div>

      <h3 className="vc-h3 mb-2.5" style={{ color }}>{mode.title}</h3>
      <p className="text-[17px] leading-[1.55] mb-5" style={{ color: descColor }}>{mode.description}</p>

      <ul className="flex flex-col gap-2.5 mb-5 list-none">
        {mode.features.map(f => (
          <li key={f} className="text-[15px] flex gap-2.5 items-start" style={{ color }}>
            <span style={{ color: "var(--brass)", fontWeight: 700 }} aria-hidden="true">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div
        className="mt-auto pt-5 border-t text-[13px] font-bold uppercase"
        style={{ letterSpacing: "1.5px", borderColor: idealBorder, color: idealColor }}
      >{mode.ideal}</div>
    </Link>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/modes-showcase.tsx
git commit -m "feat(design): ModesShowcase — 3 cartes avec touches clavier"
```

---

## Task 12: Créer ManifestoSection

**Files:**
- Create: `src/components/manifesto-section.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
// src/components/manifesto-section.tsx
const ITEMS = [
  {
    mark: "Aa",
    title: "Police Luciole, conçue pour les malvoyants",
    body: "Développée par le CTRDV (Centre Technique Régional pour la Déficience Visuelle) avec des utilisateurs basse vision. Caractères ambigus (b/d/p/q, 0/O, I/l/1) dessinés distinctement.",
  },
  {
    mark: "✓",
    title: "Contraste WCAG AAA sur tout le site",
    body: "Ratio minimum 11:1 pour le texte courant. Testé sous simulations glaucome, DMLA, cataracte et daltonisme. Quatre profils visuels sélectionnables en un clic.",
  },
  {
    mark: "♿",
    title: "Tout au clavier, tout au lecteur d'écran",
    body: "NVDA, JAWS, VoiceOver, TalkBack testés. Focus visible doublé, annonces ARIA live, raccourcis documentés. Compatible Windows High-Contrast Mode.",
  },
  {
    mark: "🔇",
    title: "Voix désactivable, animations respectueuses",
    body: "Koraly peut se taire. prefers-reduced-motion respecté. Bip aigu/grave signale début et fin d'écoute — pas d'overlay visuel distrayant.",
  },
];

export function ManifestoSection() {
  return (
    <section id="a11y" className="py-24 lg:py-28" style={{ background: "var(--bg-alt)" }}>
      <div className="max-w-[1200px] mx-auto px-10 grid gap-20 items-start lg:grid-cols-[1fr_1.2fr]">
        <div>
          <span className="vc-eyebrow">Nos engagements</span>
          <h2 className="vc-h2 mt-5 mb-5" style={{ color: "var(--text)" }}>
            L&apos;accessibilité,<br />c&apos;est le produit.<br />Pas une case cochée.
          </h2>
          <p className="text-[17px] leading-[1.6] max-w-[420px]" style={{ color: "var(--text-soft)" }}>
            Chaque décision technique, visuelle et sonore a été prise avec des utilisateurs déficients visuels — pas pour eux.
          </p>
          <div className="mt-9 p-6 rounded-r-lg" style={{ background: "var(--bg-card)", borderLeft: "4px solid var(--brass)" }}>
            <div className="text-5xl font-bold leading-none" style={{ color: "var(--accent)", letterSpacing: "-1.5px" }}>1,7 M</div>
            <div className="mt-2 text-[15px] leading-[1.5]" style={{ color: "var(--text-soft)" }}>
              personnes déficientes visuelles en France dont <strong>207 000 aveugles</strong>. VoixCourses leur rend l&apos;autonomie des courses en ligne.
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-8">
          {ITEMS.map(it => (
            <div key={it.title} className="grid gap-5 items-start" style={{ gridTemplateColumns: "56px 1fr" }}>
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg"
                style={{ background: "var(--accent)", color: "var(--bg)" }}
                aria-hidden="true"
              >{it.mark}</div>
              <div>
                <h4 className="text-[19px] font-bold mb-2 leading-[1.3]" style={{ color: "var(--text)" }}>{it.title}</h4>
                <p className="text-base leading-[1.6]" style={{ color: "var(--text-soft)" }}>{it.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/manifesto-section.tsx
git commit -m "feat(design): ManifestoSection avec 4 engagements + stat 1,7M"
```

---

## Task 13: Créer WalkthroughDialog

**Files:**
- Create: `src/components/walkthrough-dialog.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
// src/components/walkthrough-dialog.tsx
export function WalkthroughDialog() {
  return (
    <section className="py-24 lg:py-28" style={{ background: "var(--bg)" }}>
      <div className="max-w-[1200px] mx-auto px-10">
        <span className="vc-eyebrow">Un exemple concret</span>
        <h2 className="vc-h2 mt-4" style={{ color: "var(--text)" }}>Vos mots, votre panier.</h2>
        <p className="mt-2 text-[17px] max-w-[640px] mb-12" style={{ color: "var(--text-soft)" }}>
          Ce que vous entendriez à l&apos;oreille et liriez à l&apos;écran pour un produit choisi. Chaque échange est annoncé au lecteur d&apos;écran.
        </p>

        <div className="grid gap-4 max-w-[760px]">
          <Bubble who="Koraly">Que puis-je ajouter à votre panier ?</Bubble>
          <Bubble who="Vous">Des pommes Golden, un kilo.</Bubble>
          <Bubble who="Koraly">J&apos;ai trouvé 5 propositions. La première : Pommes Golden, sachet 1 kg, 2,89 € chez Carrefour. Je valide ?</Bubble>
          <ProductBubble />
          <Bubble who="Vous">Oui, parfait.</Bubble>
          <Bubble who="Koraly">Ajouté. Produit suivant ?</Bubble>
        </div>
      </div>
    </section>
  );
}

function Bubble({ who, children }: { who: "Koraly" | "Vous"; children: React.ReactNode }) {
  const isK = who === "Koraly";
  return (
    <div
      className="px-6 py-5 rounded-xl text-[17px] leading-[1.55] max-w-[85%]"
      style={{
        background: isK ? "var(--accent-ink)" : "var(--bg-alt)",
        color: isK ? "var(--bg)" : "var(--text)",
        borderRadius: isK ? "12px 12px 12px 2px" : "12px 12px 2px 12px",
        alignSelf: isK ? "flex-start" : "flex-end",
        justifySelf: isK ? "start" : "end",
      }}
    >
      <div className="vc-micro mb-1.5" style={{ color: isK ? "var(--brass)" : "var(--accent)" }}>{who}</div>
      {children}
    </div>
  );
}

function ProductBubble() {
  return (
    <div
      className="px-6 py-5 rounded-xl max-w-[95%]"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        color: "var(--text)",
        borderRadius: "12px 12px 12px 2px",
      }}
    >
      <div className="vc-micro mb-2.5" style={{ color: "var(--text-muted)" }}>Produit sélectionné · Choix 1 sur 5</div>
      <div className="flex gap-4 items-center">
        <div
          aria-hidden="true"
          className="w-16 h-16 rounded-lg flex-shrink-0"
          style={{ background: "linear-gradient(135deg, var(--accent), var(--brass))" }}
        />
        <div className="flex-1">
          <div className="text-[17px] font-bold mb-1">Pommes Golden, sachet 1 kg</div>
          <div className="text-sm" style={{ color: "var(--text-muted)" }}>
            Carrefour · 2,89 € · Origine France · <strong style={{ color: "var(--accent)" }}>Nutriscore A</strong>
          </div>
        </div>
      </div>
      <div className="flex gap-2.5 mt-3">
        <button className="px-4 py-2.5 text-sm font-bold rounded-md" style={{ background: "var(--accent)", color: "var(--bg)" }}>✓ Confirmer</button>
        <button className="px-4 py-2.5 text-sm font-bold rounded-md border-[1.5px]" style={{ borderColor: "var(--text)", color: "var(--text)" }}>Suivant →</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/walkthrough-dialog.tsx
git commit -m "feat(design): WalkthroughDialog dialogue en bulles avec produit inline"
```

---

## Task 14: Créer TestimonySection

**Files:**
- Create: `src/components/testimony-section.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
// src/components/testimony-section.tsx
export function TestimonySection() {
  return (
    <section className="py-24 lg:py-28" style={{ background: "var(--accent-ink)", color: "var(--bg)" }}>
      <div className="max-w-[1200px] mx-auto px-10 grid gap-16 items-center lg:grid-cols-2">
        <div>
          <span className="vc-eyebrow" style={{ color: "var(--brass)" }}>Ils utilisent VoixCourses</span>
          <blockquote className="text-[28px] leading-[1.35] font-normal mt-6" style={{ letterSpacing: "-0.4px" }}>
            <Quote />
            Avant, je devais attendre ma fille pour faire les courses le samedi. Maintenant je les fais seule, en trois minutes, quand je veux. J&apos;ai retrouvé un pan entier de mon autonomie.
            <Quote close />
          </blockquote>
          <cite className="block mt-7 not-italic text-base" style={{ color: "rgba(244,238,227,0.75)" }}>
            <strong className="block text-[17px] mb-0.5" style={{ color: "var(--bg)", fontWeight: 700 }}>Marie-Thérèse, 67 ans</strong>
            Non-voyante depuis 12 ans · Strasbourg
          </cite>
        </div>
        <div
          aria-hidden="true"
          className="aspect-[4/5] rounded-xl flex items-end p-6 text-sm"
          style={{
            background: "linear-gradient(135deg, #2A4F7E 0%, var(--brass) 120%)",
            color: "var(--bg)",
          }}
        >📸 Photo authentique — femme 60+ en cuisine</div>
      </div>
    </section>
  );
}

function Quote({ close = false }: { close?: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        color: "var(--brass)", fontSize: 60, lineHeight: 0,
        verticalAlign: close ? "-28px" : "-20px",
        marginLeft: close ? 2 : 0,
        marginRight: close ? 0 : 4,
      }}
    >{close ? "»" : "«"}</span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/testimony-section.tsx
git commit -m "feat(design): TestimonySection Marie-Thérèse avec citation"
```

---

## Task 15: Créer FaqAccordion

**Files:**
- Create: `src/components/faq-accordion.tsx`
- Create: `src/components/faq-accordion.test.tsx`

- [ ] **Step 1: Écrire le test d'abord**

```tsx
// src/components/faq-accordion.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FaqAccordion } from "./faq-accordion";

describe("FaqAccordion", () => {
  it("rend toutes les questions", () => {
    render(<FaqAccordion />);
    expect(screen.getAllByRole("group").length).toBeGreaterThanOrEqual(5);
  });

  it("permet d'ouvrir une réponse au clic", async () => {
    const user = userEvent.setup();
    render(<FaqAccordion />);
    const first = screen.getAllByRole("group")[0];
    const summary = first.querySelector("summary")!;
    await user.click(summary);
    expect(first).toHaveAttribute("open");
  });
});
```

- [ ] **Step 2: Lancer le test (doit échouer)**

```bash
pnpm vitest run src/components/faq-accordion.test.tsx
```
Expected : FAIL, module introuvable.

- [ ] **Step 3: Créer le composant**

```tsx
// src/components/faq-accordion.tsx
const FAQS = [
  {
    q: "Faut-il installer quelque chose ?",
    a: "Non. VoixCourses fonctionne dans votre navigateur. Pour certaines enseignes, une extension Chrome optionnelle améliore la finalisation du panier — son installation se fait en un clic, et elle est elle-même accessible au clavier.",
  },
  {
    q: "Koraly comprend-elle mon accent ?",
    a: "Oui. Koraly est entraînée sur toutes les variations du français (métropolitain, régional, ultramarin, et les accents d'origine non-francophone). Si elle se trompe, vous pouvez toujours corriger — à la voix ou au clavier.",
  },
  {
    q: "Mon lecteur d'écran est-il compatible ?",
    a: "Nous testons à chaque sortie NVDA (Windows), JAWS (Windows), VoiceOver (macOS, iOS) et TalkBack (Android). Si vous utilisez autre chose, dites-le-nous — nous ajoutons les compatibilités au fur et à mesure.",
  },
  {
    q: "Combien ça coûte ?",
    a: "Gratuit pour les particuliers. Les enseignes partenaires financent le service (c'est leur engagement accessibilité). Vous payez vos courses au prix catalogue de l'enseigne, rien de plus.",
  },
  {
    q: "Qu'en est-il de mes données personnelles ?",
    a: "Votre voix n'est jamais stockée. Votre liste de courses reste sur votre appareil. Seul le panier final est transmis à l'enseigne — comme si vous aviez rempli son site vous-même. RGPD conforme, serveurs français.",
  },
];

export function FaqAccordion() {
  return (
    <section className="py-24 lg:py-28" style={{ background: "var(--bg)" }}>
      <div className="max-w-[1200px] mx-auto px-10">
        <span className="vc-eyebrow">Questions fréquentes</span>
        <h2 className="vc-h2 mt-4" style={{ color: "var(--text)" }}>Accessibilité, technique, tarification.</h2>
        <p className="mt-2 text-[17px] max-w-[640px] mb-12" style={{ color: "var(--text-soft)" }}>
          Les questions qu&apos;on nous pose le plus souvent. Si la vôtre n&apos;y est pas, <a href="mailto:contact@voixcourses.fr" className="underline" style={{ color: "var(--accent)" }}>écrivez-nous</a>.
        </p>
        <div>
          {FAQS.map((f, i) => (
            <details
              key={f.q}
              role="group"
              className="px-7 py-6 border-b"
              style={{ borderColor: "var(--border)", borderTop: i === 0 ? "1px solid var(--border)" : undefined }}
            >
              <summary className="text-[19px] font-bold flex justify-between items-center cursor-pointer" style={{ color: "var(--text)" }}>
                {f.q}
                <span aria-hidden="true" className="text-2xl ml-4 flex-shrink-0" style={{ color: "var(--brass)" }}>+</span>
              </summary>
              <p className="mt-3 text-base leading-[1.65]" style={{ color: "var(--text-soft)" }}>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Lancer le test (doit passer)**

```bash
pnpm vitest run src/components/faq-accordion.test.tsx
```
Expected : 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/faq-accordion.tsx src/components/faq-accordion.test.tsx
git commit -m "feat(design): FaqAccordion avec details natif et 5 questions"
```

---

## Task 16: Créer FinalCtaSection

**Files:**
- Create: `src/components/final-cta-section.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
// src/components/final-cta-section.tsx
import Link from "next/link";

interface FinalCtaSectionProps {
  onListenDemo?: () => void;
}

export function FinalCtaSection({ onListenDemo }: FinalCtaSectionProps = {}) {
  return (
    <section className="py-32 text-center" style={{ background: "var(--bg-alt)" }}>
      <div className="max-w-[1200px] mx-auto px-10">
        <span className="vc-eyebrow">Prêt ?</span>
        <h2 className="vc-h2 mt-4 mx-auto max-w-[720px]" style={{ color: "var(--text)" }}>
          Faites vos courses en trois minutes,<br />sans regarder un écran.
        </h2>
        <p className="mt-5 mx-auto max-w-[560px] text-[19px]" style={{ color: "var(--text-soft)" }}>
          Gratuit, sans inscription, accessible immédiatement. Koraly vous attend.
        </p>
        <div className="mt-8 inline-flex gap-3.5">
          <Link
            href="/courses"
            className="px-7 py-4 rounded-md font-bold text-base no-underline"
            style={{ background: "var(--accent)", color: "var(--bg)" }}
          >Commencer mes courses</Link>
          <button
            onClick={onListenDemo}
            className="px-6 py-3.5 rounded-md font-bold text-base bg-transparent border-[1.5px]"
            style={{ borderColor: "var(--text)", color: "var(--text)" }}
          >🔊 Écouter la démonstration</button>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/final-cta-section.tsx
git commit -m "feat(design): FinalCtaSection plein écran"
```

---

## Task 17: Créer le hook useWelcomeAudio

**Files:**
- Create: `src/lib/speech/use-welcome-audio.ts`

- [ ] **Step 1: Créer le hook**

```ts
// src/lib/speech/use-welcome-audio.ts
"use client";

import { useEffect, useRef } from "react";

const GREETING = "Bonjour, je suis Koraly.";
const SESSION_KEY = "voixcourses-welcome-played";

interface UseWelcomeAudioOptions {
  /** Si false (voix coupée), ne rien faire. */
  voiceEnabled: boolean;
  /** Fonction speak du hook useSpeech (TTS premium + fallback). */
  speak: (text: string) => Promise<void>;
}

/**
 * Joue l'accueil vocal "Bonjour, je suis Koraly." au premier chargement de
 * la home dans une session donnée. Respecte :
 * - le toggle voix global (voiceEnabled)
 * - prefers-reduced-motion (pas directement, mais on ne joue qu'une fois
 *   par session via sessionStorage)
 * - autoplay policies (si bloqué, échec silencieux)
 *
 * Ne se déclenche pas si l'utilisateur a déjà entendu le message dans la
 * session (sessionStorage) — évite de surprendre après une navigation retour.
 */
export function useWelcomeAudio({ voiceEnabled, speak }: UseWelcomeAudioOptions) {
  const playedRef = useRef(false);

  useEffect(() => {
    if (playedRef.current) return;
    if (!voiceEnabled) return;
    if (typeof window === "undefined") return;

    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1") {
        playedRef.current = true;
        return;
      }
    } catch { /* noop */ }

    playedRef.current = true;

    const t = setTimeout(() => {
      speak(GREETING)
        .then(() => {
          try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* noop */ }
        })
        .catch(() => { /* autoplay bloqué, pas grave */ });
    }, 600);

    return () => clearTimeout(t);
  }, [voiceEnabled, speak]);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/speech/use-welcome-audio.ts
git commit -m "feat(voice): hook d'accueil Bonjour je suis Koraly"
```

---

## Task 18: Réécrire src/app/page.tsx

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Remplacer entièrement la page**

```tsx
// src/app/page.tsx
"use client";

import { useCallback, useState } from "react";
import { AccessibilityBar } from "@/components/accessibility-bar";
import { SiteHeader } from "@/components/site-header";
import { HeroSection } from "@/components/hero-section";
import { TrustStrip } from "@/components/trust-strip";
import { ModesShowcase } from "@/components/modes-showcase";
import { ManifestoSection } from "@/components/manifesto-section";
import { WalkthroughDialog } from "@/components/walkthrough-dialog";
import { TestimonySection } from "@/components/testimony-section";
import { FaqAccordion } from "@/components/faq-accordion";
import { FinalCtaSection } from "@/components/final-cta-section";
import { Footer } from "@/components/footer";
import { LiveRegion } from "@/components/live-region";
import { HelpDialog } from "@/components/help-dialog";
import { useSpeech } from "@/lib/speech/use-speech";
import { useWelcomeAudio } from "@/lib/speech/use-welcome-audio";
import { useKeyboardShortcuts } from "@/lib/speech/use-keyboard-shortcuts";
import { usePreferences, SPEECH_RATE_VALUE } from "@/lib/preferences/use-preferences";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

export default function HomePage() {
  useDocumentTitle("VoixCourses — Vos courses par la voix");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const { prefs } = usePreferences();

  const { speak } = useSpeech({
    enabled: voiceEnabled,
    rate: SPEECH_RATE_VALUE[prefs.speechRate],
    locale: prefs.speechLocale,
  });

  useWelcomeAudio({ voiceEnabled, speak });

  const playDemo = useCallback(() => {
    speak(
      "Bonjour, je suis Koraly. Dites-moi ce dont vous avez besoin. Par exemple : pommes Golden, lait demi-écrémé, pain complet."
    ).catch(() => {});
  }, [speak]);

  useKeyboardShortcuts({
    onHelp: () => setHelpOpen(true),
    onMode1: () => { window.location.href = "/courses"; },
    onMode2: () => { window.location.href = "/courses?voice=on"; },
    onMode3: () => { window.location.href = "/courses/conversation"; },
  });

  return (
    <>
      <LiveRegion />
      <AccessibilityBar
        onVoiceToggle={setVoiceEnabled}
        onHelpRequest={() => setHelpOpen(true)}
      />
      <SiteHeader />
      <HeroSection onListenDemo={playDemo} />
      <TrustStrip />
      <ModesShowcase />
      <ManifestoSection />
      <WalkthroughDialog />
      <TestimonySection />
      <FaqAccordion />
      <FinalCtaSection onListenDemo={playDemo} />
      <Footer />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
```

- [ ] **Step 2: Vérifier les props des hooks existants**

```bash
grep -n "export function useKeyboardShortcuts\|onMode1\|onHelp" src/lib/speech/use-keyboard-shortcuts.ts
```
Si les noms ne matchent pas (ex: props différentes), adapter les `onMode1/onMode2/onMode3` selon la signature réelle du hook. L'objectif : garder les raccourcis 1/2/3 pour mener aux trois modes.

- [ ] **Step 3: Lancer le dev server et vérifier la home**

```bash
pnpm dev
```
Ouvrir `http://localhost:3000`. Attendu :
- Barre accessibilité en haut avec 4 thèmes
- Header VoixCourses. par Koraly
- Hero avec orb animée
- Toutes les sections jusqu'au footer 4 colonnes

Si la voix est activée et autoplay non bloqué, l'accueil "Bonjour, je suis Koraly." se joue après ~600ms.

- [ ] **Step 4: Lancer les tests et le lint**

```bash
pnpm test && pnpm lint
```
Expected : tous tests passent, pas de warning lint significatif.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(home): refonte complète avec sections Marine éditorial"
```

---

## Task 19: Harmoniser /courses avec SiteHeader + Footer

**Files:**
- Modify: `src/app/courses/page.tsx`

**Contexte :** La page existante a son propre mini-header (Logo + nav light). On la remplace par `SiteHeader compact` pour cohérence, sans toucher à la logique métier (store/input/clarif/results/cart).

- [ ] **Step 1: Identifier le header actuel et son emplacement**

```bash
grep -n "Logo\|<header\|max-w-2xl mx-auto" src/app/courses/page.tsx | head -20
```
Noter les lignes concernées (ex: L52–L88).

- [ ] **Step 2: Remplacer le mini-header par SiteHeader**

Dans `src/app/courses/page.tsx` :

1. Ajouter l'import en haut :

```tsx
import { SiteHeader } from "@/components/site-header";
```

2. Retirer le bloc du header existant (entre `<header>...</header>` ou la `<Logo />` standalone en haut de rendu) et le remplacer par :

```tsx
<SiteHeader compact />
```

3. Conserver l'`AccessibilityBar` juste au-dessus (inchangée).

4. S'assurer que `Footer` du bas est déjà en place (sinon l'ajouter : `<Footer />` avant la fermeture du fragment).

- [ ] **Step 3: Retirer les `style={{ background: ... }}` ou classes tailwind qui hardcodent des couleurs hors tokens**

```bash
grep -n 'bg-\[#\|text-\[#\|bg-blue\|bg-gray' src/app/courses/page.tsx
```
Chaque occurrence doit être remplacée par `bg-[var(--accent)]` / `text-[var(--text)]` (ou un autre token valide). Ne pas remplacer aveuglément — si un écart a du sens (ex: badge de statut d'erreur), le laisser.

- [ ] **Step 4: Vérifier visuellement**

```bash
pnpm dev
```
Ouvrir `/courses`. Attendu : fond crème, header VoixCourses. par Koraly, flow store→input→results inchangé, Footer 4 colonnes en bas.

- [ ] **Step 5: Commit**

```bash
git add src/app/courses/page.tsx
git commit -m "refactor(courses): utiliser SiteHeader commun et tokens globaux"
```

---

## Task 20: Harmoniser /courses/conversation

**Files:**
- Modify: `src/app/courses/conversation/page-client.tsx`

- [ ] **Step 1: Ajouter SiteHeader + Footer**

1. Import en haut :

```tsx
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
```

2. Remplacer le mini-header actuel (probablement bouton retour + titre) par `<SiteHeader compact />` juste après `<AccessibilityBar />`.

3. Ajouter `<Footer />` avant la fermeture du fragment principal.

- [ ] **Step 2: Remplacer les couleurs hardcodées par tokens**

```bash
grep -n 'bg-\[#\|text-\[#\|#0f0f1a\|#1a1a2e' src/app/courses/conversation/page-client.tsx
```
Remplacer chaque hex par le token correspondant (`var(--bg)`, `var(--bg-surface)`, `var(--accent)`, etc.).

- [ ] **Step 3: Vérifier le mode conversation**

```bash
pnpm dev
```
Ouvrir `/courses/conversation`. Attendu : fond crème, orb de conversation visible, transcript lisible, Footer 4 colonnes. Tester qu'un clic sur le micro active toujours la conversation.

- [ ] **Step 4: Commit**

```bash
git add src/app/courses/conversation/page-client.tsx
git commit -m "refactor(conversation): SiteHeader + Footer + tokens"
```

---

## Task 21: Harmoniser /installer

**Files:**
- Modify: `src/app/installer/page.tsx`

- [ ] **Step 1: Ajouter SiteHeader + Footer**

1. Imports :

```tsx
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { AccessibilityBar } from "@/components/accessibility-bar";
```

2. Wrap le contenu actuel :

```tsx
return (
  <>
    <AccessibilityBar />
    <SiteHeader compact />
    <div className="max-w-[960px] mx-auto px-10 py-12">
      {/* contenu existant de la page */}
    </div>
    <Footer />
  </>
);
```

3. Retirer l'ancien `<Link href="/">← Retour à VoixCourses</Link>` puisque le header gère le retour via le logo.

- [ ] **Step 2: Typographie accessible**

Remplacer les classes `text-sm text-3xl` etc. par les utilitaires `vc-h1/vc-h2/vc-h3/vc-body` définis dans globals.css quand c'est pertinent :

```bash
grep -n 'text-3xl\|text-2xl\|text-xl' src/app/installer/page.tsx
```
Pour chaque heading principal, utiliser `className="vc-h2"` (au lieu de `text-3xl font-bold`). Conserver la sémantique HTML (`<h1>`, `<h2>`).

- [ ] **Step 3: Vérifier le rendu**

```bash
pnpm dev
```
Ouvrir `/installer`. Attendu : header + contenu lisible 18px + Footer 4 colonnes.

- [ ] **Step 4: Commit**

```bash
git add src/app/installer/page.tsx
git commit -m "refactor(installer): SiteHeader + Footer + typo accessible"
```

---

## Task 22: Mettre à jour le composant Logo (si utilisé ailleurs)

**Files:**
- Modify: `src/components/logo.tsx`

- [ ] **Step 1: Lire le composant actuel**

```bash
cat src/components/logo.tsx
```

- [ ] **Step 2: Vérifier s'il est toujours utilisé**

```bash
grep -rn "from.*components/logo\|import.*Logo" src/ | grep -v "site-header" | grep -v "logo.tsx"
```

Si tous les usages ont été remplacés par `SiteHeader`, supprimer le fichier :

```bash
git rm src/components/logo.tsx
```

Sinon, adapter `Logo` pour qu'il reprenne le nouveau style (logo + point brass + "par Koraly") :

```tsx
// src/components/logo.tsx
export function Logo({ subtitle = true }: { subtitle?: boolean }) {
  return (
    <div className="flex items-baseline gap-3.5">
      <span className="text-2xl font-bold" style={{ letterSpacing: "-0.6px", color: "var(--text)" }}>VoixCourses</span>
      <span style={{ color: "var(--brass)", fontSize: 28, lineHeight: 1, marginLeft: -2 }}>.</span>
      {subtitle && (
        <span
          className="pl-3.5 border-l text-[12px] font-semibold uppercase"
          style={{ letterSpacing: "2.5px", borderColor: "var(--border)", color: "var(--text-muted)" }}
        >par Koraly</span>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/logo.tsx 2>/dev/null || git add -u src/components/logo.tsx
git commit -m "chore(logo): aligner sur nouvelle identité VoixCourses. par Koraly"
```

---

## Task 23: Vérification globale, tests, lint, typecheck

**Files:** aucun

- [ ] **Step 1: Lancer la suite complète**

```bash
pnpm test
```
Expected : tous les tests (27 existants + 2 orb + 2 faq = ~31) passent.

- [ ] **Step 2: Lint**

```bash
pnpm lint
```
Expected : aucune erreur. Warnings acceptables s'ils étaient déjà présents.

- [ ] **Step 3: Typecheck**

```bash
pnpm tsc --noEmit
```
Expected : aucune erreur de type.

- [ ] **Step 4: Build production**

```bash
pnpm build
```
Expected : build réussi, aucune erreur de compilation.

- [ ] **Step 5: Run dev + walkthrough manuel**

```bash
pnpm dev
```

Vérifier dans le navigateur :

- `/` home complète : hero, orb animée, 3 modes, manifeste, dialogue, témoignage, FAQ, CTA, footer
- Accueil audio "Bonjour, je suis Koraly" joué (voix activée)
- Bascule entre les 4 thèmes (Clair / Sombre / Jaune-Noir / Blanc-Bleu) : contraste AAA dans chacun, pas de texte invisible
- `Aa −` / `Aa +` fait varier la taille de 16 à 28px
- Coupure voix persistée (reload conserve OFF)
- `/courses` : flow complet store → input → results → cart
- `/courses/conversation` : activer micro, conversation fonctionne
- `/installer` : instructions visibles, lisibles
- Focus visible partout (Tab) : ring jaune 3px
- Test lecteur d'écran (VoiceOver macOS ou NVDA) sur la home : h1 annoncé, manifeste lisible, FAQ navigable

- [ ] **Step 6: Commit final (si ajustements de verification)**

```bash
git add -A
git commit -m "chore: vérifications finales redesign Marine éditorial" --allow-empty
```

---

## Self-Review (post-écriture)

**Spec coverage :**
- ✓ Naming VoixCourses + Koraly → Task 2 (metadata), Task 6 (footer), Task 7 (SiteHeader), Task 17 (welcome audio)
- ✓ Tokens Marine complets → Task 3
- ✓ Luciole → Task 1, 2
- ✓ 4 profils visuels → Task 3 (CSS), Task 4 (init), Task 5 (UI)
- ✓ Base 18px → Task 3
- ✓ Structure home 10 sections → Task 9–16, Task 18
- ✓ Orb animations → Task 8
- ✓ Welcome audio → Task 17
- ✓ AAA partout, focus doublé → Task 3
- ✓ Application aux pages existantes → Task 19, 20, 21
- ✓ Footer enrichi → Task 6

**Placeholder scan :** aucun TBD/TODO/similar to task dans les steps — chaque step contient code exact ou commande.

**Type consistency :** `KoralyOrbStatus = "idle" | "listening" | "speaking"` utilisé en Task 8 et cohérent. `Theme = "clair" | "sombre" | "jaune-noir" | "blanc-bleu"` en Task 5 cohérent avec les classes CSS Task 3 et Task 4.

**Gap connus acceptés :**
- Le téléchargement Luciole (Task 1) dépend de la disponibilité du CDN CTRDV. Plan inclut un fallback.
- Welcome audio (Task 17) utilise `sessionStorage` pour ne pas rejouer — si le navigateur le bloque, pas d'erreur, on rejoue à chaque chargement de home (comportement acceptable).

---

## Plan complete

Plan sauvegardé dans `docs/superpowers/plans/2026-04-12-voixcourses-redesign.md`.

Deux options d'exécution :

**1. Subagent-Driven (recommandé pour ce plan — 23 tâches)** : je dispatch un subagent par tâche, tu reviews entre, itération rapide. Plus lent en calendrier mais plus sûr.

**2. Inline Execution** : j'exécute les tâches dans cette session avec checkpoints tous les 3-5 tasks pour que tu revoies.

Quelle approche ?
